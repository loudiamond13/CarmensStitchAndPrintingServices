using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Auth;

/// <summary>D-43, CWE-639: one device signs out another of the caller's own sessions, never someone else's and never itself.</summary>
public sealed class RevokeSessionHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 14, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid UserId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");
    private static readonly Guid StrangerId = Guid.Parse("7a1c9b34-1f0e-4d6a-8f21-5c3b9e0d4a77");
    private static readonly SessionSettings Settings = new AuthSettings().ToSessionSettings();

    [Fact]
    public async Task AnotherDeviceOfTheCallerIsRevokedEvictedAndAuditedOnce()
    {
        var harness = new Harness();
        harness.Time.Advance(TimeSpan.FromMinutes(3));

        var result = await harness.Handler.HandleAsync(harness.Other.Id, TestContext.Current.CancellationToken);

        result.Value.ShouldBe(new RevokeSessionResponse(AlreadySignedOut: false));
        harness.Other.RevokedReason.ShouldBe(SessionRevocationReason.DeviceSignedOut);
        harness.Other.RevokedAt.ShouldBe(Start.AddMinutes(3));
        harness.Audit.Entries.ShouldBe([new AuditCall(AuditActions.SessionRevoked, "UserSession", harness.Other.Id.ToString("D"), null, Independent: false)]);
        await harness.Cache.Received(1).EvictAsync(harness.Other.Id, Arg.Any<CancellationToken>());
        harness.Unit.Saves.ShouldBe(1);
    }

    [Fact]
    public async Task AnotherUsersSessionAndAnUnknownIdGetTheSameNotFoundAndChangeNothing()
    {
        var harness = new Harness();

        var foreign = await harness.Handler.HandleAsync(harness.Stranger.Id, TestContext.Current.CancellationToken);
        var unknown = await harness.Handler.HandleAsync(Guid.CreateVersion7(), TestContext.Current.CancellationToken);

        foreign.Error.ShouldBeSameAs(AuthErrors.SessionNotFound);
        unknown.Error.ShouldBeSameAs(AuthErrors.SessionNotFound);
        AuthErrors.SessionNotFound.Kind.ShouldBe(ErrorKind.NotFound);
        AuthErrors.SessionNotFound.Code.ShouldBe("sessions.not-found");
        harness.Stranger.RevokedAt.ShouldBeNull();
        harness.NothingWritten();
        await harness.Cache.DidNotReceive().EvictAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task TheCurrentSessionIsRefusedAndStaysActive()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(harness.Current.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionCurrent);
        AuthErrors.SessionCurrent.Kind.ShouldBe(ErrorKind.BusinessRule);
        AuthErrors.SessionCurrent.Code.ShouldBe("sessions.current");
        AuthErrors.SessionCurrent.Message.ShouldBe("Use Logout to sign out this device.");
        harness.Current.RevokedAt.ShouldBeNull();
        harness.NothingWritten();
    }

    [Fact]
    public async Task ARevokedOrExpiredSessionOfTheCallerIsAnAlreadySignedOutSuccessWithNothingWritten()
    {
        var harness = new Harness();
        harness.Other.Revoke(SessionRevocationReason.SignedOut, Start);
        harness.Time.Advance(TimeSpan.FromDays(1));

        var revoked = await harness.Handler.HandleAsync(harness.Other.Id, TestContext.Current.CancellationToken);
        var expired = await harness.Handler.HandleAsync(harness.Expired.Id, TestContext.Current.CancellationToken);

        revoked.Value.ShouldBe(new RevokeSessionResponse(AlreadySignedOut: true));
        expired.Value.ShouldBe(new RevokeSessionResponse(AlreadySignedOut: true));
        harness.Other.RevokedReason.ShouldBe(SessionRevocationReason.SignedOut);
        harness.NothingWritten();
        await harness.Cache.DidNotReceive().EvictAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task WithoutAUserOrASessionTheAnswerIsSessionEndedAndNothingIsRead(bool noUser, bool noSession)
    {
        var harness = new Harness(noUser, noSession);

        var result = await harness.Handler.HandleAsync(harness.Other.Id, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Store.DidNotReceive().FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        harness.Other.RevokedAt.ShouldBeNull();
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceThenAnswersBusy()
    {
        var harness = new Harness();
        harness.ReloadFreshEachTime();
        harness.Unit.FailFirstSaveWithConflict();
        (await harness.Handler.HandleAsync(harness.Other.Id, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        harness.Unit.Saves.ShouldBe(2);

        var busyHarness = new Harness();
        busyHarness.ReloadFreshEachTime();
        busyHarness.Unit.FailEverySaveWithConflict();
        var busy = await busyHarness.Handler.HandleAsync(busyHarness.Other.Id, TestContext.Current.CancellationToken);

        busy.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
    }

    private sealed class Harness
    {
        public Harness(bool noUser = false, bool noSession = false)
        {
            Time = new FakeTimeProvider(Start);
            Current = Started(UserId);
            Other = Started(UserId);
            Stranger = Started(StrangerId);
            Expired = Started(UserId, Start.AddDays(-100));

            var all = new[] { Current, Other, Stranger, Expired };
            Store = Substitute.For<ISessions>();
            Store.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
                .Returns(call => Task.FromResult(all.SingleOrDefault(session => session.Id == call.Arg<Guid>())));
            Cache = Substitute.For<ISessionCache>();
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noUser ? null : UserId);
            request.SessionId.Returns(noSession ? null : Current.Id);
            Handler = new RevokeSessionHandler(Store, Cache, request, Audit, Unit, Time);
        }

        public UserSession Current { get; }

        public UserSession Other { get; }

        public UserSession Stranger { get; }

        public UserSession Expired { get; }

        public ISessions Store { get; }

        public ISessionCache Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public FakeTimeProvider Time { get; }

        public RevokeSessionHandler Handler { get; }

        // A real store reads the rows again after a lost race, so the revoke done in memory by the failed pass is gone.
        public void ReloadFreshEachTime() =>
            Store.FindAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns(_ => Task.FromResult<UserSession?>(Started(UserId)));

        public void NothingWritten()
        {
            Audit.Entries.ShouldBeEmpty();
            Unit.Saves.ShouldBe(0);
        }

        private static UserSession Started(Guid userId, DateTimeOffset? at = null) =>
            UserSession.Start(userId, persistent: false, "Chrome on Android", TokenHash.Compute(Guid.NewGuid().ToString("N")), at ?? Start, Settings).Session;
    }
}
