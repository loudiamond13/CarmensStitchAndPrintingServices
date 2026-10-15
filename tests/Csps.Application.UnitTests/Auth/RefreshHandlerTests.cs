using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-05, AUTH-10, D-39, T-04-50, T-04-53, T-04-54: rotation, grace siblings, reuse revocation, the fixed end and inactive accounts.</summary>
public sealed class RefreshHandlerTests
{
    private const string FirstToken = "token-0";
    private const string NewToken = "token-new";
    private const string Email = "paolo.reyes@example.com";

    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly SessionSettings Sessions = new AuthSettings().ToSessionSettings();

    [Fact]
    public async Task AFirstUseRotatesTheTokenAndIssuesAnAccessTokenForTheCurrentRole()
    {
        var harness = new Harness(role: "Admin");
        harness.Time.Advance(TimeSpan.FromMinutes(14));

        var result = await harness.RunAsync();

        var outcome = result.Value;
        outcome.RefreshToken.ShouldBe(NewToken);
        outcome.CookieExpiresAt.ShouldBe(Start.AddDays(90));
        outcome.Response.AccessToken.ShouldBe("jwt");
        outcome.Response.SessionExpiresAt.ShouldBe(Start.AddDays(90));
        outcome.Response.Persistent.ShouldBeTrue();
        outcome.Response.User.ShouldBe(new SessionUser(UserId, Email, "Paolo", "Reyes", "Admin"));
        harness.AccessTokens.Received(1).Issue(UserId, "Admin", harness.Session.Id);
        harness.SessionStore.Received(1).AddToken(Arg.Is<RefreshToken>(token => TokenHash.Equal(token.TokenHash, TokenHash.Compute(NewToken))));
        harness.Session.LastActiveAt.ShouldBe(Start.AddMinutes(14));
        harness.Unit.Saves.ShouldBe(1);
        harness.Audit.Entries.ShouldBeEmpty();
        await harness.Cache.DidNotReceive().EvictAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ABrowserSessionHasNoCookieExpiry()
    {
        var harness = new Harness(persistent: false);

        var result = await harness.RunAsync();

        result.Value.CookieExpiresAt.ShouldBeNull();
        result.Value.Response.Persistent.ShouldBeFalse();
        result.Value.Response.SessionExpiresAt.ShouldBe(Start.AddHours(12));
    }

    [Fact]
    public async Task AUsedTokenInsideTheGraceWindowGetsASibling()
    {
        var harness = new Harness();
        harness.RotateOnce(Start.AddSeconds(1));
        harness.Time.Advance(TimeSpan.FromSeconds(20));

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
        harness.SessionStore.Received(1).AddToken(Arg.Any<RefreshToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Session.IsActive(harness.Time.GetUtcNow()).ShouldBeTrue();
    }

    [Fact]
    public async Task AReplayedTokenRevokesTheSessionAuditsAndEvictsIt()
    {
        var harness = new Harness();
        harness.RotateOnce(Start.AddSeconds(1));
        harness.Time.Advance(TimeSpan.FromSeconds(40));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        harness.Session.RevokedReason.ShouldBe(SessionRevocationReason.ReuseDetected);
        harness.Audit.Entries.ShouldBe(
            [new AuditCall(AuditActions.RefreshReuseDetected, "UserSession", harness.Session.Id.ToString("D"), null, Independent: true)]);
        await harness.Cache.Received(1).EvictAsync(harness.Session.Id, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
        harness.SessionStore.DidNotReceive().AddToken(Arg.Any<RefreshToken>());
    }

    [Fact]
    public async Task ARevokedSessionIsAnEndedSessionWithNoAuditAndNoSave()
    {
        var harness = new Harness();
        harness.Session.Revoke(SessionRevocationReason.SignedOut, Start.AddMinutes(1), harness.Lookup.Related);

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        await harness.Cache.DidNotReceive().EvictAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(12 * 60 * 60 - 1, true)]
    [InlineData(12 * 60 * 60, false)]
    [InlineData(12 * 60 * 60 + 1, false)]
    public async Task ABrowserSessionEndsExactlyTwelveHoursAfterSignIn(int seconds, bool refreshes)
    {
        var harness = new Harness(persistent: false);
        harness.Time.Advance(TimeSpan.FromSeconds(seconds));

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBe(refreshes);
    }

    [Fact]
    public async Task APersistentSessionRefreshesAt89DaysAndEndsAt90()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromDays(89));
        (await harness.RunAsync()).IsSuccess.ShouldBeTrue();

        var ended = new Harness();
        ended.Time.Advance(TimeSpan.FromDays(90));
        (await ended.RunAsync()).Error.ShouldBeSameAs(AuthErrors.SessionEnded);
    }

    [Theory]
    [InlineData("deactivated")]
    [InlineData("missing")]
    public async Task AnAccountThatCannotSignInLosesTheSessionAtTheNextRefresh(string state)
    {
        var harness = new Harness(account: state);
        harness.Time.Advance(TimeSpan.FromMinutes(5));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        harness.Session.RevokedReason.ShouldBe(SessionRevocationReason.AccountInactive);
        harness.Session.RevokedAt.ShouldBe(Start.AddMinutes(5));
        harness.Audit.Entries.ShouldBe(
            [new AuditCall(AuditActions.SessionRevoked, "UserSession", harness.Session.Id.ToString("D"), null, Independent: false)]);
        await harness.Cache.Received(1).EvictAsync(harness.Session.Id, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
        harness.SessionStore.DidNotReceive().AddToken(Arg.Any<RefreshToken>());
        harness.Lookup.Presented.ConsumedAt.ShouldBeNull();
    }

    [Fact]
    public async Task ATemporaryLockRefusesTheRefreshButKeepsTheSession()
    {
        var harness = new Harness(account: "locked");
        harness.Time.Advance(TimeSpan.FromMinutes(5));

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        harness.Session.RevokedAt.ShouldBeNull();
        harness.Session.RevokedReason.ShouldBeNull();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.SessionStore.DidNotReceive().AddToken(Arg.Any<RefreshToken>());
        harness.Lookup.Presented.ConsumedAt.ShouldBeNull();
    }

    [Fact]
    public async Task ALockThatHasEndedDoesNotStopARefresh()
    {
        var harness = new Harness(account: "lock-over");

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task NoCookieIsAnEndedSessionWithoutAnyLookup(string? token)
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(token, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.SessionStore.DidNotReceive().FindByRefreshHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnknownTokenIsAnEndedSession()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync("another-token", TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        harness.Unit.Saves.ShouldBe(0);
    }

    [Fact]
    public async Task ASaveConflictIsRetriedOnceAndTheSecondPassFindsAGraceSibling()
    {
        var harness = new Harness();
        var raced = Harness.NewSession(persistent: true);
        raced.Session.Rotate(raced.Token, [raced.Token], TokenHash.Compute("token-other-tab"), Start.AddSeconds(1), Sessions);
        var second = new RefreshLookup(raced.Session, raced.Token, [raced.Token]);
        harness.SessionStore.FindByRefreshHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
            .Returns(Task.FromResult<RefreshLookup?>(harness.Lookup), Task.FromResult<RefreshLookup?>(second));
        harness.Unit.FailFirstSaveWithConflict();
        harness.Time.Advance(TimeSpan.FromSeconds(2));

        var result = await harness.RunAsync();

        result.IsSuccess.ShouldBeTrue();
        result.Value.RefreshToken.ShouldBe(NewToken);
        harness.Unit.Saves.ShouldBe(2);
        await harness.SessionStore.Received(2).FindByRefreshHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>());
        raced.Session.IsActive(harness.Time.GetUtcNow()).ShouldBeTrue();
    }

    [Fact]
    public async Task ASecondSaveConflictIsAConflictAnswerNotASignOut()
    {
        var harness = new Harness();
        harness.Unit.FailEverySaveWithConflict();

        var result = await harness.RunAsync();

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        result.Error.Kind.ShouldBe(ErrorKind.Conflict);
        harness.Session.IsActive(harness.Time.GetUtcNow()).ShouldBeTrue();
    }

    [Fact]
    public void TheOutcomeNeverPrintsTheToken() =>
        new RefreshOutcome(new SessionResponse("jwt", Start, Start, true, new SessionUser(UserId, Email, "P", "R", "Manager")), NewToken, null)
            .ToString().ShouldNotContain(NewToken);

    private sealed class Harness
    {
        public Harness(string account = "active", string role = "Manager", bool persistent = true)
        {
            Time = new FakeTimeProvider(Start);
            (Session, var token) = NewSession(persistent);
            Lookup = new RefreshLookup(Session, token, [token]);

            SessionStore = Substitute.For<ISessions>();
            SessionStore.FindByRefreshHashAsync(Arg.Any<byte[]>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult<RefreshLookup?>(TokenHash.Equal(call.Arg<byte[]>(), TokenHash.Compute(FirstToken)) ? Lookup : null));

            var accounts = Substitute.For<IUserAccounts>();
            UserAccount? user = account switch
            {
                "missing" => null,
                "deactivated" => Account(role, isActive: false),
                "locked" => Account(role, lockoutEnd: Start.AddMinutes(30)),
                "lock-over" => Account(role, lockoutEnd: Start.AddMinutes(-1)),
                _ => Account(role),
            };
            accounts.FindByIdAsync(UserId, Arg.Any<CancellationToken>()).Returns(Task.FromResult(user));

            AccessTokens = Substitute.For<IAccessTokenIssuer>();
            AccessTokens.Issue(Arg.Any<Guid>(), Arg.Any<string>(), Arg.Any<Guid>()).Returns(new AccessToken("jwt", Start.AddMinutes(15)));
            var random = Substitute.For<ISecureRandom>();
            random.NewToken().Returns(NewToken);
            Cache = Substitute.For<ISessionCache>();

            Handler = new RefreshHandler(SessionStore, accounts, AccessTokens, random, Cache, Audit, Unit, new AuthSettings(), Time);
        }

        public UserSession Session { get; }

        public RefreshLookup Lookup { get; private set; }

        public ISessions SessionStore { get; }

        public IAccessTokenIssuer AccessTokens { get; }

        public ISessionCache Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public RefreshHandler Handler { get; }

        public static (UserSession Session, RefreshToken Token) NewSession(bool persistent) =>
            UserSession.Start(UserId, persistent, "Chrome on Android", TokenHash.Compute(FirstToken), Start, Sessions);

        public Task<Result<RefreshOutcome>> RunAsync() => Handler.HandleAsync(FirstToken, TestContext.Current.CancellationToken);

        // Uses the first token once, as a refresh from another tab did.
        public void RotateOnce(DateTimeOffset at)
        {
            var child = Session.Rotate(Lookup.Presented, Lookup.Related, TokenHash.Compute("token-1"), at, Sessions).NewToken.ShouldNotBeNull();
            Lookup = new RefreshLookup(Session, Lookup.Presented, [Lookup.Presented, child]);
        }

        private static UserAccount Account(string role, bool isActive = true, DateTimeOffset? lockoutEnd = null) =>
            new(UserId, Email, "Paolo", "Reyes", role, isActive, true, true, null, false, lockoutEnd);
    }
}
