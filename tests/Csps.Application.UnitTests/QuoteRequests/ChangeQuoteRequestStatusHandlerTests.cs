using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>D-15, SEC-07, SEC-08: staff move a request freely with its row version; every move is one history row and one audit entry in one save.</summary>
public sealed class ChangeQuoteRequestStatusHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("4d2c7a19-8b36-4f05-9e71-3a6b0c8d5f24");
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 2, 0, 0, TimeSpan.Zero);
    private static readonly TimeZoneInfo Manila = TimeZoneInfo.FindSystemTimeZoneById("Asia/Manila");
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 7, 209];

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static string Version => Convert.ToBase64String(StoredVersion);

    [Fact]
    public async Task AMoveRecordsOneHistoryRowAndOneAuditEntryInOneSaveAndAnswersOnlyTheNewStatusAndVersion()
    {
        var harness = new Harness();
        harness.NextVersion = [0, 0, 0, 0, 0, 0, 7, 210];

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest(" Contacted ", Version), Token);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new QuoteRequestStatusChangedResponse(harness.Request.Id, "contacted", Now, "AAAAAAAAB9I="));
        harness.Request.Status.ShouldBe(QuoteRequestStatus.Contacted);
        harness.Request.StatusChangedAtUtc.ShouldBe(Now);
        var row = harness.Request.StatusChanges.ShouldHaveSingleItem();
        (row.FromStatus, row.ToStatus, row.ChangedById, row.ChangedAtUtc).ShouldBe((QuoteRequestStatus.New, QuoteRequestStatus.Contacted, (Guid?)CallerId, Now));
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail, entry.Independent)
            .ShouldBe(("quote-request.status-changed", "QuoteRequest", AuditKey.Of(harness.Request.Id), "status=new>contacted", false));
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Deletions.ReceivedCalls().ShouldBeEmpty();
    }

    [Fact]
    public async Task SpamQueuesEachStoredPhotoAsQuoteSpamInsideTheTransactionBeforeTheOneSave()
    {
        var harness = new Harness(["front.jpg", "sketch.heic", "back.png"]);
        harness.Fill(0, "quotes/a/front");
        harness.Fill(2, "quotes/a/back");
        var queued = new List<(string Id, ImageDeletionReason Reason, bool InTransaction, int SavesBefore)>();
        harness.Deletions
            .When(queue => queue.Enqueue(Arg.Any<string>(), Arg.Any<ImageDeletionReason>()))
            .Do(call => queued.Add((call.ArgAt<string>(0), call.ArgAt<ImageDeletionReason>(1), harness.Unit.InTransaction, harness.Unit.Saves)));

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("spam", Version), Token);

        result.IsSuccess.ShouldBeTrue();
        queued.ShouldBe(
        [
            ("quotes/a/front", ImageDeletionReason.QuoteSpam, true, 0),
            ("quotes/a/back", ImageDeletionReason.QuoteSpam, true, 0),
        ]);
        harness.Request.Photos.ShouldBeEmpty();
        harness.Request.PhotosRemovedAtUtc.ShouldBe(Now);
        harness.Audit.Entries.ShouldHaveSingleItem().Detail.ShouldBe("status=new>spam");
        harness.Unit.Saves.ShouldBe(1);
        await harness.Deletions.DidNotReceive().EnqueueNowAsync(Arg.Any<string>(), Arg.Any<ImageDeletionReason>(), Arg.Any<CancellationToken>());
        await harness.Deletions.DidNotReceive().EnqueueManyNowAsync(Arg.Any<IReadOnlyCollection<string>>(), Arg.Any<ImageDeletionReason>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoUsableAccountIs401AndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("contacted", Version), Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null, "AAAAAAAAB9E=", "status")]
    [InlineData("converted", "AAAAAAAAB9E=", "status")]
    [InlineData("archived", "AAAAAAAAB9E=", "status")]
    [InlineData("contacted", null, "version")]
    [InlineData("contacted", "not-a-version", "version")]
    public async Task ABadStatusOrVersionIs400AndTheRequestIsNotRead(string? status, string? version, string field)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest(status, version), Token);

        result.Error.Code.ShouldBe("quote-requests.validation");
        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe([field], ignoreOrder: true);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnEmptyBodyNamesBothFields()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, ChangeQuoteRequestStatusRequest.Empty, Token);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["status", "version"], ignoreOrder: true);
        result.Error.FieldErrors!["status"].ShouldBe(["Choose a status."]);
        result.Error.FieldErrors!["version"].ShouldBe([RowVersions.InvalidMessage]);
    }

    [Fact]
    public async Task AnUnknownRequestIs404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), new ChangeQuoteRequestStatusRequest("contacted", Version), Token);

        result.Error.Code.ShouldBe("quote-requests.not-found");
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AStaleVersionIs409AndNothingChanges()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("contacted", "AAAAAAAAB9I="), Token);

        result.Error.Code.ShouldBe("quote-requests.conflict");
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        result.Error.Message.ShouldBe("This was changed by someone else. Reload and try again.");
        harness.Request.Status.ShouldBe(QuoteRequestStatus.New);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARaceLostAtTheSaveIs409()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("quoted", Version), Token);

        result.Error.Code.ShouldBe("quote-requests.conflict");
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task TheSameStatusIs400AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("new", Version), Token);

        result.Error.FieldErrors.ShouldNotBeNull()["status"].ShouldBe(["This request is already New."]);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AConvertedRequestIs400ConvertedLockedAndNothingIsSaved()
    {
        var harness = new Harness();
        typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.Status))!.SetValue(harness.Request, QuoteRequestStatus.Converted);

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new ChangeQuoteRequestStatusRequest("closed", Version), Token);

        result.Error.Code.ShouldBe("quote-requests.converted-locked");
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AMissingRequestThrows()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.Request.Id, null!, Token));
    }

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
            : this([], noCaller)
        {
        }

        public Harness(IReadOnlyList<string> photoNames, bool noCaller = false)
        {
            Request = QuoteRequest.Receive(
                Guid.CreateVersion7(Received),
                new QuoteRequestInput("Juan Dela Cruz", null, "0917 123 4567", null),
                Received).Value;
            if (photoNames.Count > 0)
            {
                Request.DeclarePhotos(photoNames, new byte[QuoteRequestRules.UploadKeyHashLength], Received.AddHours(2)).IsSuccess.ShouldBeTrue();
            }

            SetVersion(StoredVersion.ToArray());
            Store.FindAsync(Request.Id, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<QuoteRequest?>(Request));
            Unit = new FakeUnitOfWork(() =>
            {
                if (NextVersion is { } next)
                {
                    SetVersion(next);
                }
            });
            var context = Substitute.For<IRequestContext>();
            context.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ChangeQuoteRequestStatusHandler(
                Store,
                Deletions,
                new FixedCalendar(),
                Audit,
                Unit,
                context,
                new ChangeQuoteRequestStatusRequestValidator());
        }

        public QuoteRequest Request { get; }

        // Fills a place the way the upload's conditional update does in the database.
        public void Fill(int slot, string publicId) =>
            typeof(QuoteRequestPhoto).GetProperty(nameof(QuoteRequestPhoto.PublicId))!.SetValue(Request.Photos[slot], publicId);

        public IQuoteRequestStore Store { get; } = Substitute.For<IQuoteRequestStore>();

        public IImageDeletionQueue Deletions { get; } = Substitute.For<IImageDeletionQueue>();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; }

        /// <summary>The row version a good save gives the request, as the database does; unchanged when null.</summary>
        public byte[]? NextVersion { get; set; }

        public ChangeQuoteRequestStatusHandler Handler { get; }

        private void SetVersion(byte[] version) =>
            typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Request, version);
    }

    private sealed class FixedCalendar : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new BusinessClock(Manila, ZoneSource.Stored, Now));
    }
}
