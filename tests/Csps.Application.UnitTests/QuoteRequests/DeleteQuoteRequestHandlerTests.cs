using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.Common;
using Csps.Domain.QuoteRequests;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>D-16, SEC-07, CWE-532: a Manager delete checks the version, refuses Converted, queues stored photos and is audited without customer details, in one save.</summary>
public sealed class DeleteQuoteRequestHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("4d2c7a19-8b36-4f05-9e71-3a6b0c8d5f24");
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);
    private static readonly byte[] StoredVersion = [0, 0, 0, 0, 0, 0, 7, 209];

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    private static string Version => Convert.ToBase64String(StoredVersion);

    [Fact]
    public async Task TheDeleteQueuesEachStoredPhotoRemovesTheRequestAndRecordsOneEntryBeforeTheOneSave()
    {
        var harness = new Harness(["front.jpg", "sketch.heic", "back.png"]);
        harness.Fill(0, "quotes/a/front");
        harness.Fill(2, "quotes/a/back");
        var queued = new List<(string Id, ImageDeletionReason Reason, bool InTransaction, int SavesBefore)>();
        harness.Deletions
            .When(queue => queue.Enqueue(Arg.Any<string>(), Arg.Any<ImageDeletionReason>()))
            .Do(call => queued.Add((call.ArgAt<string>(0), call.ArgAt<ImageDeletionReason>(1), harness.Unit.InTransaction, harness.Unit.Saves)));

        var result = await harness.Handler.HandleAsync(harness.Request.Id, Version, Token);

        result.IsSuccess.ShouldBeTrue();
        queued.ShouldBe(
        [
            ("quotes/a/front", ImageDeletionReason.QuoteDeleted, true, 0),
            ("quotes/a/back", ImageDeletionReason.QuoteDeleted, true, 0),
        ]);
        harness.Store.Received(1).Remove(harness.Request);
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail, entry.Independent)
            .ShouldBe(("quote-request.deleted", "QuoteRequest", AuditKey.Of(harness.Request.Id), "status=new;photos=2", false));
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        await harness.Deletions.DidNotReceive().EnqueueNowAsync(Arg.Any<string>(), Arg.Any<ImageDeletionReason>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task NoUsableAccountIs401AndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Request.Id, Version, Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(null)]
    [InlineData("not-a-version")]
    public async Task AMissingOrMalformedVersionIs400AndTheRequestIsNotRead(string? version)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, version, Token);

        result.Error.Code.ShouldBe("quote-requests.validation");
        result.Error.FieldErrors.ShouldNotBeNull()["version"].ShouldBe([RowVersions.InvalidMessage]);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownRequestIs404AndNothingIsRemoved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), Version, Token);

        result.Error.Code.ShouldBe("quote-requests.not-found");
        harness.Store.DidNotReceive().Remove(Arg.Any<QuoteRequest>());
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task AConvertedRequestIs400AndNothingIsRemoved()
    {
        var harness = new Harness();
        typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.Status))!.SetValue(harness.Request, QuoteRequestStatus.Converted);

        var result = await harness.Handler.HandleAsync(harness.Request.Id, Version, Token);

        result.Error.Code.ShouldBe("quote-requests.converted-locked");
        result.Error.Kind.ShouldBe(ErrorKind.Validation);
        result.Error.Message.ShouldBe("A request that became an order can't be deleted.");
        harness.Store.DidNotReceive().Remove(Arg.Any<QuoteRequest>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task AStaleVersionIs409AndNothingIsRemoved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, "AAAAAAAAB9I=", Token);

        result.Error.Code.ShouldBe("quote-requests.conflict");
        harness.Store.DidNotReceive().Remove(Arg.Any<QuoteRequest>());
        harness.Deletions.ReceivedCalls().ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARaceLostAtTheSaveIs409()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, Version, Token);

        result.Error.Code.ShouldBe("quote-requests.conflict");
        harness.Unit.Commits.ShouldBe(0);
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

            typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.RowVersion), BindingFlags.Public | BindingFlags.Instance)!.SetValue(Request, StoredVersion.ToArray());
            Store.FindAsync(Request.Id, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<QuoteRequest?>(Request));
            var context = Substitute.For<IRequestContext>();
            context.UserId.Returns(noCaller ? null : CallerId);
            Handler = new DeleteQuoteRequestHandler(Store, Deletions, Audit, Unit, context);
        }

        public QuoteRequest Request { get; }

        // Fills a place the way the upload's conditional update does in the database.
        public void Fill(int slot, string publicId) =>
            typeof(QuoteRequestPhoto).GetProperty(nameof(QuoteRequestPhoto.PublicId))!.SetValue(Request.Photos[slot], publicId);

        public IQuoteRequestStore Store { get; } = Substitute.For<IQuoteRequestStore>();

        public IImageDeletionQueue Deletions { get; } = Substitute.For<IImageDeletionQueue>();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public DeleteQuoteRequestHandler Handler { get; }
    }
}
