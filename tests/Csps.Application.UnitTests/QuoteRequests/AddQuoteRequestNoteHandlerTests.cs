using System.Reflection;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.QuoteRequests;
using Csps.Application.UnitTests.Auth;
using Csps.Domain.QuoteRequests;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>D-17, SEC-08, CWE-532: a note is added with who and when from the token and the clock, audited without its text, in one save.</summary>
public sealed class AddQuoteRequestNoteHandlerTests
{
    private static readonly Guid CallerId = Guid.Parse("4d2c7a19-8b36-4f05-9e71-3a6b0c8d5f24");
    private static readonly DateTimeOffset Received = new(2026, 11, 21, 7, 42, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 2, 0, 0, TimeSpan.Zero);

    private static CancellationToken Token => TestContext.Current.CancellationToken;

    [Fact]
    public async Task ANoteIsAddedWithOneAuditEntryWithoutTheTextInOneSaveAndAnswersOnlyTheIdsTimeAndVersion()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new AddQuoteRequestNoteRequest("  Called, will send mockup Friday.  "), Token);

        result.IsSuccess.ShouldBeTrue();
        var note = harness.Request.Notes.ShouldHaveSingleItem();
        (note.Text, note.CreatedById, note.CreatedAtUtc).ShouldBe(("Called, will send mockup Friday.", CallerId, Now));
        var entry = harness.Audit.Entries.ShouldHaveSingleItem();
        (entry.Action, entry.TargetType, entry.TargetId, entry.Detail, entry.Independent)
            .ShouldBe(("quote-request.note-added", "QuoteRequest", AuditKey.Of(harness.Request.Id), $"note={note.Id:D}", false));
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        result.Value.ShouldBe(new QuoteRequestNoteAddedResponse(harness.Request.Id, note.Id, Now, "AAAAAAAAB9I="));
    }

    [Fact]
    public async Task NoUsableAccountIs401AndNothingIsRead()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new AddQuoteRequestNoteRequest("Hi."), Token);

        result.Error.ShouldBe(AuthErrors.SessionEnded);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnEmptyNoteIs400AndTheRequestIsNotRead()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, AddQuoteRequestNoteRequest.Empty, Token);

        result.Error.Code.ShouldBe("quote-requests.validation");
        result.Error.FieldErrors.ShouldNotBeNull()["text"].ShouldBe(["Write a note first."]);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownRequestIs404AndNothingIsSaved()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(Guid.NewGuid(), new AddQuoteRequestNoteRequest("Hi."), Token);

        result.Error.Code.ShouldBe("quote-requests.not-found");
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ARaceLostOnceIsReadAgainAndSaved()
    {
        var harness = new Harness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new AddQuoteRequestNoteRequest("Hi."), Token);

        result.IsSuccess.ShouldBeTrue();
        await harness.Store.Received(2).FindAsync(harness.Request.Id, Arg.Any<CancellationToken>());
        harness.Unit.Commits.ShouldBe(1);
    }

    [Fact]
    public async Task ARaceLostTwiceIs409()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.Handler.HandleAsync(harness.Request.Id, new AddQuoteRequestNoteRequest("Hi."), Token);

        result.Error.Code.ShouldBe("quote-requests.conflict");
        harness.Unit.Commits.ShouldBe(0);
    }

    [Fact]
    public async Task AMissingRequestThrows()
    {
        var harness = new Harness();

        await Should.ThrowAsync<ArgumentNullException>(() => harness.Handler.HandleAsync(harness.Request.Id, null!, Token));
    }

    private sealed class Harness
    {
        // The row version a good save gives the request, as the database does.
        private static readonly byte[] SavedVersion = [0, 0, 0, 0, 0, 0, 7, 210];

        public Harness(bool noCaller = false)
        {
            Request = QuoteRequest.Receive(
                Guid.CreateVersion7(Received),
                new QuoteRequestInput("Juan Dela Cruz", null, "0917 123 4567", null),
                Received).Value;
            Store.FindAsync(Request.Id, Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<QuoteRequest?>(Request));
            Unit = new FakeUnitOfWork(() =>
                typeof(QuoteRequest).GetProperty(nameof(QuoteRequest.RowVersion), BindingFlags.Public | BindingFlags.Instance)!
                    .SetValue(Request, SavedVersion.ToArray()));
            var context = Substitute.For<IRequestContext>();
            context.UserId.Returns(noCaller ? null : CallerId);
            Handler = new AddQuoteRequestNoteHandler(
                Store,
                Audit,
                Unit,
                context,
                new FakeTimeProvider(Now),
                new AddQuoteRequestNoteRequestValidator());
        }

        public QuoteRequest Request { get; }

        public IQuoteRequestStore Store { get; } = Substitute.For<IQuoteRequestStore>();

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; }

        public AddQuoteRequestNoteHandler Handler { get; }
    }
}
