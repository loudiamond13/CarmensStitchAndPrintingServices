using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>D-43, CWE-639: the list holds the caller's own active sessions, this device first, then by recent activity, at most 100.</summary>
public sealed class ListSessionsHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly SessionSettings Settings = new AuthSettings().ToSessionSettings();

    [Fact]
    public async Task MoreThanTheCapReturnsTheCapWithTheCurrentSessionFirstEvenWhenItIsTheOldest()
    {
        var sessions = Enumerable.Range(0, 105).Select(i => StartedAt(Start.AddMinutes(i))).ToList();
        var current = sessions[0];
        var harness = new Harness(current.Id, sessions);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        var items = result.Value;
        items.Count.ShouldBe(100);
        items[0].Id.ShouldBe(current.Id);
        items[0].Current.ShouldBeTrue();
        items.Skip(1).ShouldAllBe(item => !item.Current);
        items.Skip(1).Select(item => item.Id).ShouldBe(sessions.Skip(6).Reverse().Select(session => session.Id));
    }

    [Fact]
    public async Task ACurrentSessionTheStoreLeftOutOfItsCappedPageIsStillListedFirst()
    {
        var current = StartedAt(Start);
        var page = Enumerable.Range(1, 100).Select(i => StartedAt(Start.AddMinutes(i))).ToList();
        var harness = new Harness(current.Id, page, current);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Count.ShouldBe(100);
        result.Value[0].Id.ShouldBe(current.Id);
        result.Value[^1].Id.ShouldBe(page[1].Id);
    }

    [Fact]
    public async Task TheCurrentSessionIsLookedUpOnlyWhenTheStorePageMissesIt()
    {
        var current = StartedAt(Start);
        var harness = new Harness(current.Id, [current, StartedAt(Start.AddMinutes(1))]);

        await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EqualActivityIsOrderedBySignInTimeNewestFirstThenById()
    {
        var older = StartedAt(Start, activeAt: Start.AddMinutes(20));
        var newer = StartedAt(Start.AddMinutes(10), activeAt: Start.AddMinutes(20));
        var twinA = StartedAt(Start.AddMinutes(30));
        var twinB = StartedAt(Start.AddMinutes(30));
        var current = StartedAt(Start.AddMinutes(-60));
        var harness = new Harness(current.Id, [older, twinB, newer, current, twinA]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        var twinIds = new[] { twinA.Id, twinB.Id }.Order().ToList();
        result.Value.Select(item => item.Id).ShouldBe([current.Id, ..twinIds, newer.Id, older.Id]);
    }

    [Fact]
    public async Task AnExpiredOrRevokedSessionIsNotListed()
    {
        var current = StartedAt(Start);
        var expired = StartedAt(Start.AddDays(-100));
        var revoked = StartedAt(Start.AddMinutes(1));
        revoked.Revoke(SessionRevocationReason.DeviceSignedOut, Start);
        var live = StartedAt(Start.AddMinutes(2));
        var harness = new Harness(current.Id, [current, expired, revoked, live]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.Select(item => item.Id).ShouldBe([current.Id, live.Id]);
    }

    [Fact]
    public async Task EachItemCarriesTheDeviceTheSignInTimeTheLastActivityAndTheSessionKind()
    {
        var current = StartedAt(Start, persistent: false, label: "Edge on Windows");
        var other = StartedAt(Start.AddMinutes(5), persistent: true, label: "Chrome on Android");
        var harness = new Harness(current.Id, [current, other]);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Value.ShouldBe(
        [
            new SessionListItem(current.Id, "Edge on Windows", Start, Start, Persistent: false, Current: true),
            new SessionListItem(other.Id, "Chrome on Android", Start.AddMinutes(5), Start.AddMinutes(5), Persistent: true, Current: false),
        ]);
    }

    [Fact]
    public async Task TheStoreIsAskedForTheCallersOwnSessionsOnly()
    {
        var current = StartedAt(Start);
        var harness = new Harness(current.Id, [current]);

        await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        await harness.Store.Received(1).ListActiveAsync(UserId, Start.AddMinutes(30), ListSessionsHandler.Cap, Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task WithoutAUserOrASessionTheAnswerIsSessionEndedAndNothingIsRead(bool noUser, bool noSession)
    {
        var harness = new Harness(noSession ? null : Guid.CreateVersion7(), [], noUser: noUser);

        var result = await harness.Handler.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Store.DidNotReceive().ListActiveAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    // A refresh moves LastActiveAt without changing the sign-in time.
    private static UserSession StartedAt(DateTimeOffset at, bool persistent = true, string label = "Chrome on Android", DateTimeOffset? activeAt = null)
    {
        var (session, token) = UserSession.Start(UserId, persistent, label, TokenHash.Compute(Guid.NewGuid().ToString("N")), at, Settings);
        if (activeAt is { } refreshedAt)
        {
            session.Rotate(token, [token], TokenHash.Compute(Guid.NewGuid().ToString("N")), refreshedAt, Settings)
                .Outcome.ShouldBe(RotationOutcome.Rotated);
        }

        return session;
    }

    private sealed class Harness
    {
        public Harness(Guid? sessionId, IReadOnlyList<UserSession> storePage, UserSession? lookedUp = null, bool noUser = false)
        {
            var time = new FakeTimeProvider(Start.AddMinutes(30));
            Store = Substitute.For<ISessions>();
            Store.ListActiveAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult(storePage));
            Store.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(lookedUp is not null && lookedUp.Id == call.Arg<Guid>() ? lookedUp : null));
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noUser ? null : UserId);
            request.SessionId.Returns(sessionId);
            Handler = new ListSessionsHandler(Store, request, time);
        }

        public ISessions Store { get; }

        public ListSessionsHandler Handler { get; }
    }
}
