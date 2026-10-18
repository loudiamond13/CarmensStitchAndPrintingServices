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

/// <summary>USER-03, USER-05, D-16, D-19: reactivating mirrors deactivating, takes no roster lock, and still refuses the caller's own account.</summary>
public sealed class ActivateUserHandlerTests
{
    private static readonly DateTimeOffset Start = new(2026, 10, 18, 8, 0, 0, TimeSpan.Zero);
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Fact]
    public async Task ASuccessEndsAnyOpenSessionRecordsBothEntriesOnceAndEvictsAfterTheCommit()
    {
        var harness = new Harness();
        harness.Sessions.RevokeAllAsync(TargetId, null, SessionRevocationReason.AccountChanged, Start, Arg.Any<CancellationToken>())
            .Returns([Guid.NewGuid()]);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await harness.Accounts.Received(1).SetActiveAsync(TargetId, true, Arg.Any<CancellationToken>());
        var key = TargetId.ToString("D");
        harness.Audit.Entries.ShouldBe(
        [
            new AuditCall(AuditActions.UserActivated, "User", key, null, Independent: false),
            new AuditCall(AuditActions.SessionsRevoked, "User", key, "account-changed", Independent: false),
        ]);
        harness.Unit.Commits.ShouldBe(1);
        harness.Cache.EvictedUsers.ShouldBe([TargetId]);
        harness.Cache.CommitsWhenEvicted.ShouldBe(1);
    }

    [Fact]
    public async Task AnAccountThatIsAlreadyActiveIsASuccessThatWritesRevokesAndEvictsNothing()
    {
        var harness = new Harness();
        harness.Accounts.SetActiveAsync(TargetId, true, Arg.Any<CancellationToken>()).Returns(false);

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
    public async Task AMissingOrDeletedPersonIsANotFoundThatChangesNothing(bool deleted)
    {
        var harness = new Harness { Target = deleted ? Account(TargetId) with { IsDeleted = true } : null };

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.NotFound);
        await harness.Accounts.DidNotReceive().SetActiveAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task TheCallersOwnAccountIsRefusedAndNothingChanges()
    {
        var harness = new Harness { Target = Account(CallerId) };

        var result = await harness.Handler.HandleAsync(CallerId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        await harness.Accounts.DidNotReceive().SetActiveAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>());
        harness.Audit.Entries.ShouldBeEmpty();
    }

    [Fact]
    public async Task WithoutASignedInUserNothingIsReadOrChanged()
    {
        var harness = new Harness(noCaller: true);

        var result = await harness.Handler.HandleAsync(TargetId, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(AuthErrors.SessionEnded);
        await harness.Accounts.DidNotReceive().FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ALostRaceIsRetriedOnceThenAnswersBusyWithoutEvicting()
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

    private static UserAccount Account(Guid id) =>
        new(id, "person@csps.test", "Ana", "Abad", Roles.Manager, IsActive: false, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);

    private sealed class Harness
    {
        public Harness(bool noCaller = false)
        {
            Target = Account(TargetId);
            Accounts = Substitute.For<IUserAccounts>();
            Accounts.FindByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns<Task<UserAccount?>>(_ => Task.FromResult<UserAccount?>(Target));
            Accounts.SetActiveAsync(Arg.Any<Guid>(), Arg.Any<bool>(), Arg.Any<CancellationToken>()).Returns(true);
            Sessions = Substitute.For<ISessions>();
            Sessions.RevokeAllAsync(Arg.Any<Guid>(), Arg.Any<Guid?>(), Arg.Any<SessionRevocationReason>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
                .Returns([]);
            Cache = new EvictionProbe();
            Cache.Watch(Unit);
            var request = Substitute.For<IRequestContext>();
            request.UserId.Returns(noCaller ? null : CallerId);
            Handler = new ActivateUserHandler(Accounts, Sessions, Cache, new ManagerGuard(Accounts), request, Audit, Unit, new FakeTimeProvider(Start));
        }

        public UserAccount? Target { get; set; }

        public IUserAccounts Accounts { get; }

        public ISessions Sessions { get; }

        public EvictionProbe Cache { get; }

        public RecordingAudit Audit { get; } = new();

        public FakeUnitOfWork Unit { get; } = new();

        public ActivateUserHandler Handler { get; }

    }
}
