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
/// USER-03, USER-04, USER-05, D-07..D-11, D-18, D-19: deleting takes the roster lock before reading, refuses the caller's own account and
/// the last active Manager, scrambles the account at the current time, ends every session, revokes the open links of all three kinds,
/// records <c>user.deleted</c> and the revocation once, and evicts the person from the session cache after the commit. A person who is
/// missing or already deleted is a 404 that changes and records nothing.
/// </summary>
public sealed class DeleteUserHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task ADeleteScramblesAtTheCurrentTimeEndsEverySessionRecordsBothEntriesOnceAndEvictsAfterTheCommit()
    {
        var harness = new Harness();
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid(), Guid.NewGuid()]);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SoftDeleteAsync(TargetId, Start, Arg.Any<CancellationToken>());
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserDeleted, "User", key, null, Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Unit.Saves.ShouldBe(1);
        harness.Unit.Commits.ShouldBe(1);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.SavesWhenEvicted.ShouldBe(1);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task TheOpenLinksOfAllThreeKindsAreRevokedAtTheCurrentTime()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        foreach (var purpose in new[] { AccountTokenPurpose.Invitation, AccountTokenPurpose.PasswordReset, AccountTokenPurpose.EmailChange })
        {
            await harness.Tokens.Received(1).RevokeOpenAsync(TargetId, purpose, Start, Arg.Any<CancellationToken>());
        }
    }

    [Fact]
    public async Task ADeleteWithNobodySignedInRecordsOnlyTheDeleteButStillEvicts()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        harness.Audit.Entries.ShouldHaveSingleItem().Action.ShouldBe(AuditActions.UserDeleted);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task AMissingOrAlreadyDeletedPersonIsANotFoundThatChangesAndRecordsNothing(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account(TargetId) with { IsDeleted = true } : null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await AssertNothingChangedAsync(harness);
    }

    [Fact]
    public async Task APersonDeletedByAnotherRequestFirstIsANotFoundThatRecordsNothing()
    {
        var harness = new Harness();
        harness.Accounts.SoftDeleteAsync(TargetId, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(false);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheRosterLockIsTakenBeforeTheTargetIsRead()
    {
        var harness = new Harness();

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
        var harness = new Harness { Target = Account(CallerId) };

        var result = await harness.Handler.HandleAsync(CallerId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await AssertNothingChangedAsync(harness);
    }

    [Fact]
    public async Task TheLastActiveManagerIsRefusedAndNothingChanges()
    {
        var harness = new Harness { Target = Account(TargetId) with { Role = Roles.Manager } };
        harness.Accounts.CountActiveManagersAsync(TargetId, Arg.Any<CancellationToken>()).Returns(0);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.LastActiveManager);
        await AssertNothingChangedAsync(harness);
    }

    [Fact]
    public async Task AManagerIsDeletedWhileAnotherActiveManagerRemains()
    {
        var harness = new Harness { Target = Account(TargetId) with { Role = Roles.Manager } };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SoftDeleteAsync(TargetId, Start, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnAdminIsDeletedWithoutCountingManagers()
    {
        var harness = new Harness();

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ADeleteWithoutASignedInUserReadsNothingAndChangesNothing()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ADeleteThatLostARaceIsRetriedOnceThenAnswersBusyWithoutEvicting()
    {
        var retried = new Harness();
        retried.Unit.FailFirstSaveWithConflict();
        (await retried.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken)).IsSuccess.ShouldBeTrue();
        retried.Unit.Saves.ShouldBe(2);

        var busy = new Harness();
        busy.Unit.FailEverySaveWithConflict();
        var result = await busy.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionBusy);
        busy.Cache.EvictedUsers.ShouldBeEmpty();
    }

    [Fact]
    public void TheScrambledAddressIsUniquePerIdAndInTheReservedDomain()
    {
        DeletedAddress.For(TargetId).ShouldBe("deleted-0d8f2f6e5c0a4a649f4e2b6e4d1d7a10@deleted.invalid");
        DeletedAddress.For(CallerId).ShouldNotBe(DeletedAddress.For(TargetId));
        DeletedAddress.For(TargetId).ShouldEndWith("@" + DeletedAddress.Domain);
    }

    private static async Task AssertNothingChangedAsync(Harness harness)
    {
        await harness.Accounts.DidNotReceive().SoftDeleteAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        await harness.Tokens.DidNotReceive().RevokeOpenAsync(Arg.Any<Guid>(), Arg.Any<AccountTokenPurpose>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
        harness.Unit.Saves.ShouldBe(0);
        harness.Cache.EvictedUsers.ShouldBeEmpty();
    }

    private static UserAccount Account(Guid id) =>
        new(id, "person@csps.test", "Ana", "Abad", Roles.Admin, IsActive: true, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Target = Account(TargetId);
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns<Task<UserAccount?>>(_ => Task.FromResult<UserAccount?>(Target));
            Accounts.SoftDeleteAsync(Arg.Any<Guid>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>()).Returns(true);
            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns([]);
            Tokens = Substitute.For<IAccountTokens>();
            Cache = new EvictionProbe();
            Cache.Watch(Unit);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            RosterLock = Substitute.For<IManagerRosterLock>();
            Accounts.CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(1);
            Handler = new DeleteUserHandler(Accounts, Sessions, Cache, RosterLock, new ManagerGuard(Accounts), Tokens, request, Audit, Unit, new FakeTimeProvider(Start));
        }

        public UserAccount? Target { get; set; }

        public IUserAccounts Accounts { get; }

        public ISessions Sessions { get; }

        public IAccountTokens Tokens { get; }

        public IManagerRosterLock RosterLock { get; }

        public EvictionProbe Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public DeleteUserHandler Handler { get; }
    }
}
