using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Domain.Common;
using NSubstitute;

namespace Csps.Application.UnitTests.Users;

/// <summary>D-18, D-19: nobody acts on their own account, and the last active Manager is never removed.</summary>
public sealed class ManagerGuardTests
{
    private static readonly Guid CallerId = Guid.Parse("7c1e0b52-3d94-4a8e-b6f0-9a2d5e8c1f43");
    private static readonly Guid TargetId = Guid.Parse("0d8f2f6e-5c0a-4a64-9f4e-2b6e4d1d7a10");

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task TheCallersOwnAccountIsRefusedWhetherOrNotTheChangeRemovesAManager(bool removesActiveManager)
    {
        var accounts = Substitute.For<IUserAccounts>();

        var result = await new ManagerGuard(accounts).CheckAsync(Account(CallerId), CallerId, removesActiveManager, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.OwnAccount);
        UserErrors.OwnAccount.Kind.ShouldBe(ErrorKind.BusinessRule);
        UserErrors.OwnAccount.Code.ShouldBe("users.own-account");
        UserErrors.OwnAccount.Message.ShouldBe("You can't do this to your own account.");
        await accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task APersonWhoIsNotAManagerPassesWithoutCountingAnyone()
    {
        var accounts = Substitute.For<IUserAccounts>();

        var result = await new ManagerGuard(accounts).CheckAsync(Account(TargetId, Roles.Admin), CallerId, removesActiveManager: true, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AnActiveManagerPassesWhileAnotherActiveManagerRemains()
    {
        var accounts = Substitute.For<IUserAccounts>();
        accounts.CountActiveManagersAsync(TargetId, Arg.Any<CancellationToken>()).Returns(1);

        var result = await new ManagerGuard(accounts).CheckAsync(Account(TargetId), CallerId, removesActiveManager: true, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public async Task TheLastActiveManagerIsRefusedAfterCountingEveryoneButTheTarget()
    {
        var accounts = Substitute.For<IUserAccounts>();
        accounts.CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>()).Returns(0);

        var result = await new ManagerGuard(accounts).CheckAsync(Account(TargetId), CallerId, removesActiveManager: true, TestContext.Current.CancellationToken);

        result.Error.ShouldBeSameAs(UserErrors.LastActiveManager);
        UserErrors.LastActiveManager.Kind.ShouldBe(ErrorKind.BusinessRule);
        UserErrors.LastActiveManager.Code.ShouldBe("users.last-active-manager");
        UserErrors.LastActiveManager.Message.ShouldBe("You can't remove the last active Manager.");
        await accounts.Received(1).CountActiveManagersAsync(TargetId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AChangeThatRemovesNoManagerPassesWithoutCounting()
    {
        var accounts = Substitute.For<IUserAccounts>();

        var result = await new ManagerGuard(accounts).CheckAsync(Account(TargetId), CallerId, removesActiveManager: false, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(false, false, false)]
    [InlineData(true, true, false)]
    [InlineData(true, false, true)]
    public async Task AManagerWhoIsInactiveLockedOrDeletedIsNotCountedSoRemovingThemNeedsNoOtherManager(bool active, bool managerLocked, bool deleted)
    {
        var accounts = Substitute.For<IUserAccounts>();
        var target = Account(TargetId) with { IsActive = active, IsManagerLocked = managerLocked, IsDeleted = deleted };

        var result = await new ManagerGuard(accounts).CheckAsync(target, CallerId, removesActiveManager: true, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        await accounts.DidNotReceive().CountActiveManagersAsync(Arg.Any<Guid?>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void AFailedPasswordLockoutDoesNotStopAManagerFromCountingAsActive()
    {
        var lockedOut = Account(TargetId) with { LockoutEnd = new DateTimeOffset(2099, 1, 1, 0, 0, 0, TimeSpan.Zero) };

        ManagerGuard.IsActiveManager(lockedOut).ShouldBeTrue();
        ManagerGuard.IsActiveManager(Account(TargetId, Roles.Admin)).ShouldBeFalse();
    }

    private static UserAccount Account(Guid id, string role = Roles.Manager) =>
        new(id, "person@csps.test", "Ana", "Abad", role, IsActive: true, EmailConfirmed: true, HasPassword: true, MustChangePassword: null, BreachRecheckPending: false, LockoutEnd: null);
}
