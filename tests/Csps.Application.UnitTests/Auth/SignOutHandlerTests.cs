using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-06, D-05, D-44: signing out ends this session; "sign out other devices" ends the rest and keeps this one; both always succeed.</summary>
public sealed class SignOutHandlerTests
{
    private const string Token = "token-0";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly SessionSettings Sessions = new AuthSettings().ToSessionSettings();

    [Fact]
    public async Task SigningOutRevokesTheSessionEvictsItAndAudits()
    {
        var harness = new SignOutHarness();
        harness.Time.Advance(TimeSpan.FromMinutes(3));

        var result = await harness.SignOut.HandleAsync(Token, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Session.RevokedReason.ShouldBe(SessionRevocationReason.SignedOut);
        harness.Session.RevokedAt.ShouldBe(Start.AddMinutes(3));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.SignedOut, "UserSession", harness.Session.Id.ToString("D"), null, Independent: false)]);
        await harness.Cache.Received(1).EvictAsync(harness.Session.Id, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("another-token")]
    public async Task NoCookieOrAnUnknownTokenIsStillASuccessWithNothingWritten(string? token)
    {
        var harness = new SignOutHarness();

        var result = await harness.SignOut.HandleAsync(token, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Session.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public async Task AnAlreadyEndedSessionIsASuccessWithNothingWritten()
    {
        var harness = new SignOutHarness();
        harness.Session.Revoke(SessionRevocationReason.ReuseDetected, Start, harness.Related);

        var result = await harness.SignOut.HandleAsync(Token, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnce()
    {
        var harness = new SignOutHarness();
        harness.Unit.FailFirstSaveWithConflict();

        var result = await harness.SignOut.HandleAsync(Token, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);
    }

    [Fact]
    public async Task TwoLostRacesAreABusyAnswerNotAFalseSuccess()
    {
        var harness = new SignOutHarness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.SignOut.HandleAsync(Token, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    [Fact]
    public async Task SigningOutOthersRevokesTheRestKeepsThisOneEvictsThemAndAuditsOnce()
    {
        var harness = new SignOutHarness();
        var others = new[] { Guid.CreateVersion7(), Guid.CreateVersion7() };
        harness.SessionStore.RevokeAllAsync(UserId, harness.Session.Id, SessionRevocationReason.SignedOutOtherDevices, Start, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<Guid>>(others));

        var result = await harness.SignOutOthers.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.SessionsRevoked, "User", UserId.ToString("D"), "sign-out-others", Independent: false)]);
        foreach (var id in others)
        {
            await harness.Cache.Received(1).EvictAsync(id, Arg.Any<CancellationToken>());
        }

        await harness.Cache.DidNotReceive().EvictAsync(harness.Session.Id, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task SigningOutOthersWithNoOtherSessionIsASuccessWithNothingWritten()
    {
        var harness = new SignOutHarness();

        var result = await harness.SignOutOthers.HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        await harness.Cache.DidNotReceive().EvictAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false, true)]
    [InlineData(true, false)]
    public async Task SigningOutOthersWithoutAUserOrASessionRefusesAndNeverRevokesAll(bool noUser, bool noSession)
    {
        var harness = new SignOutHarness(noUser: noUser, noSession: noSession);

        var result = await harness.SignOutOthers.HandleAsync(TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.SessionStore.DidNotReceive().RevokeAllAsync(
            Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SigningOutOthersRetriesALostRaceOnceThenAnswersBusy()
    {
        var harness = new SignOutHarness();
        var others = new[] { Guid.CreateVersion7() };
        harness.SessionStore.RevokeAllAsync(UserId, harness.Session.Id, SessionRevocationReason.SignedOutOtherDevices, Start, Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<IReadOnlyList<Guid>>(others));
        harness.Unit.FailFirstSaveWithConflict();
        (await harness.SignOutOthers.HandleAsync(TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();

        harness.Unit.FailEverySaveWithConflict();
        var busy = await harness.SignOutOthers.HandleAsync(TestContext.Current.CancellationToken);

        busy.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    private sealed class SignOutHarness
    {
        public SignOutHarness(bool noUser = false, bool noSession = false)
        {
            Time = new FakeTimeProvider(Start);
            var (session, token) = UserSession.Start(UserId, persistent: true, "Chrome on Android", TokenHash.Compute(Token), Start, Sessions);
            Session = session;
            Related = [token];

            SessionStore = Substitute.For<ISessions>();
            SessionStore.FindByRefreshHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult<RefreshLookup?>(
                    TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(Token)) ? new RefreshLookup(Session, token, Related) : null));
            SessionStore.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns(Task.FromResult<IReadOnlyList<Guid>>([]));

            Cache = Substitute.For<ISessionCache>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noUser ? null : UserId);
            request.SessionId.Returns(noSession ? null : session.Id);

            SignOut = new SignOutHandler(SessionStore, Cache, Audit, Unit, Time);
            SignOutOthers = new SignOutOthersHandler(SessionStore, Cache, request, Audit, Unit, Time);
        }

        public UserSession Session { get; }

        public IReadOnlyList<RefreshToken> Related { get; }

        public ISessions SessionStore { get; }

        public ISessionCache Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public SignOutHandler SignOut { get; }

        public SignOutOthersHandler SignOutOthers { get; }
    }
}
