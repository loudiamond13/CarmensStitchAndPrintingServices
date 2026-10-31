using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.UnitTests.Auth;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Microsoft.Extensions.Time.Testing;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>
/// USER-03, USER-05, D-16: locking sets the Manager lock at the current time, ends every session, records <c>user.locked</c> and the
/// revocation once, and evicts the person from the session cache after the commit. A person who is already locked changes and records
/// nothing. Unlocking mirrors it with <c>user.unlocked</c> and has no guard.
/// </summary>
public sealed class LockUserHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task ALockSetsTheLockAtTheCurrentTimeEndsEverySessionRecordsBothEntriesOnceAndEvictsAfterTheCommit()
    {
        var harness = new LockHarness();
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid(), Guid.NewGuid()]);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SetManagerLockAsync(TargetId, Start, Arg.Any<CancellationToken>());
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserLocked, "User", key, null, Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.SavesWhenEvicted.ShouldBe(1);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task TheRosterLockIsTakenBeforeTheTargetIsRead()
    {
        var harness = new LockHarness();

        await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        Received.InOrder(() =>
        {
            harness.RosterLock.LockActiveManagersAsync(Arg.Any<CancellationToken>());
            harness.Accounts.FindByIdAsync(TargetId, Arg.Any<CancellationToken>());
        });
    }

    [Fact]
    public async Task TheCallersOwnAccountIsRefusedAndNothingChanges()
    {
        var harness = new LockHarness { Target = Account(CallerId) };

        var result = await harness.Handler.HandleAsync(CallerId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await AssertNothingChangedAsync(harness);
    }

    [Fact]
    public async Task TheLastActiveManagerIsRefusedAndNothingChanges()
    {
        var harness = new LockHarness();
        harness.Accounts.CountActiveManagersAsync(TargetId, Arg.Any<CancellationToken>()).Returns(0);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.LastActiveManager);
        await AssertNothingChangedAsync(harness);
    }

    [Fact]
    public async Task AnAdminIsLockedWithoutCountingManagers()
    {
        var harness = new LockHarness { Target = Account(TargetId) with { Role = Roles.Admin } };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
        await harness.Accounts.Received(1).SetManagerLockAsync(TargetId, Start, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALockWithNobodySignedInRecordsOnlyTheLockButStillEvicts()
    {
        var harness = new LockHarness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.UserLocked);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
    }

    [Fact]
    public async Task AnAccountThatIsAlreadyLockedIsASuccessThatWritesRevokesAndEvictsNothing()
    {
        var harness = new LockHarness();
        harness.Accounts.SetManagerLockAsync(TargetId, Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>()).Returns(false);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task ALockOnAMissingOrDeletedPersonIsANotFoundThatChangesNothing(bool deleted)
    {
        var harness = new LockHarness { Target = deleted ? Account(TargetId) with { IsDeleted = true } : null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await harness.Accounts.DidNotReceive().SetManagerLockAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task ALockWithoutASignedInUserReadsNothingAndChangesNothing()
    {
        var harness = new LockHarness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALockThatLostARaceIsRetriedOnceThenAnswersBusyWithoutEvicting()
    {
        var retried = new LockHarness();
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new LockHarness();
        busy.Unit.FailEverySaveWithConflict();
        var result = await busy.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        busy.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnlockClearsTheLockEndsEverySessionRecordsBothEntriesOnceAndEvictsAfterTheCommit()
    {
        var harness = new UnlockHarness();
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid()]);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SetManagerLockAsync(TargetId, null, Arg.Any<CancellationToken>());
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserUnlocked, "User", key, null, Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.SavesWhenEvicted.ShouldBe(1);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task AnUnlockWithNobodySignedInRecordsOnlyTheUnlock()
    {
        var harness = new UnlockHarness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.UserUnlocked);
    }

    [Fact]
    public async Task AnAccountThatIsNotLockedIsASuccessThatWritesRevokesAndEvictsNothing()
    {
        var harness = new UnlockHarness();
        harness.Accounts.SetManagerLockAsync(TargetId, null, Arg.Any<CancellationToken>()).Returns(false);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        await harness.Sessions.DidNotReceive().RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AnUnlockOnAMissingOrDeletedPersonIsANotFoundThatChangesNothing(bool deleted)
    {
        var harness = new UnlockHarness { Target = deleted ? Account(TargetId) with { IsDeleted = true } : null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await harness.Accounts.DidNotReceive().SetManagerLockAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnlockWithoutASignedInUserReadsNothingAndChangesNothing()
    {
        var harness = new UnlockHarness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnlockHasNoGuardSoItNeverCountsManagersAndNeedsNoRosterLock()
    {
        var harness = new UnlockHarness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnUnlockThatLostARaceIsRetriedOnceThenAnswersBusyWithoutEvicting()
    {
        var retried = new UnlockHarness();
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new UnlockHarness();
        busy.Unit.FailEverySaveWithConflict();
        var result = await busy.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        busy.Cache.EvictedUsers.ShouldBeEmpty();
    }

    private static async Task AssertNothingChangedAsync(LockHarness harness)
    {
        await harness.Accounts.DidNotReceive().SetManagerLockAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    private static UserAccount Account(Guid id) =>
        new(id, "person@csps.test", "Ana", "Abad", Roles.Manager, IsActive: true, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private abstract class HarnessBase
    {
        protected HarnessBase(bool noCaller)
        {
            Target = Account(TargetId);
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns<Task<UserAccount?>>(_ => Task.FromResult<UserAccount?>(Target));
            Accounts.SetManagerLockAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset?>(), Arg.Any<CancellationToken>()).Returns(true);
            Accounts.CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(1);
            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns([]);
            Cache = new EvictionProbe();
            Cache.Watch(Unit);
            Request = Substitute.For<IRequestContext>();
            Request.UserId.Returns(noCaller ? null : CallerId);
        }

        public UserAccount? Target { get; set; }

        public IUserAccounts Accounts { get; }

        public ISessions Sessions { get; }

        public EvictionProbe Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        protected IRequestContext Request { get; }
    }

    private sealed class LockHarness : HarnessBase
    {
        public LockHarness(bool noCaller = false)
            : base(noCaller)
        {
            RosterLock = Substitute.For<IManagerRosterLock>();
            Handler = new LockUserHandler(Accounts, Sessions, Cache, RosterLock, new ManagerGuard(Accounts), Request, Audit, Unit, new FakeTimeProvider(Start));
        }

        public IManagerRosterLock RosterLock { get; }

        public LockUserHandler Handler { get; }
    }

    private sealed class UnlockHarness : HarnessBase
    {
        public UnlockHarness(bool noCaller = false)
            : base(noCaller)
        {
            Handler = new UnlockUserHandler(Accounts, Sessions, Cache, Request, Audit, Unit, new FakeTimeProvider(Start));
        }

        public UnlockUserHandler Handler { get; }
    }
}
