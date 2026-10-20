using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Identity;

namespace Csps.Application.UnitTests.Auth;

/// <summary>The account shapes the auth handlers pass around carry exactly what they were given and compare by value.</summary>
public sealed class UserAccountTests
{
    [Fact]
    public void UserAccountCarriesItsValues()
    {
        var id = Guid.NewGuid();
        var lockoutEnd = new DateTimeOffset(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);

        var account = new UserAccount(
            id, "paolo@example.com", "Paolo", "Garcia", "Manager", true, true, true, PasswordChangeReason.Breach, true, lockoutEnd);

        account.Id.ShouldBe(id);
        account.Email.ShouldBe("paolo@example.com");
        account.FirstName.ShouldBe("Paolo");
        account.LastName.ShouldBe("Garcia");
        account.Role.ShouldBe("Manager");
        account.IsActive.ShouldBeTrue();
        account.EmailConfirmed.ShouldBeTrue();
        account.HasPassword.ShouldBeTrue();
        account.MustChangePassword.ShouldBe(PasswordChangeReason.Breach);
        account.BreachRecheckPending.ShouldBeTrue();
        account.LockoutEnd.ShouldBe(lockoutEnd);
    }

    [Fact]
    public void UserAccountCarriesTheManagerLockAndDeletedMarks()
    {
        var plain = Account(isActive: true, managerLocked: false, deleted: false);
        var marked = Account(isActive: true, managerLocked: true, deleted: true);

        plain.IsManagerLocked.ShouldBeFalse();
        plain.IsDeleted.ShouldBeFalse();
        marked.IsManagerLocked.ShouldBeTrue();
        marked.IsDeleted.ShouldBeTrue();
    }

    [Theory]
    [InlineData(false, false, false, true)]
    [InlineData(true, true, false, true)]
    [InlineData(true, false, true, true)]
    [InlineData(false, true, true, true)]
    [InlineData(true, false, false, false)]
    public void AnAccountIsBlockedWhenDeactivatedManagerLockedOrDeleted(bool isActive, bool managerLocked, bool deleted, bool blocked) =>
        Account(isActive, managerLocked, deleted).IsBlocked.ShouldBe(blocked);

    [Fact]
    public void AFailedPasswordLockoutIsNotABlock()
    {
        var farFuture = new DateTimeOffset(2099, 1, 1, 0, 0, 0, TimeSpan.Zero);

        Account(isActive: true, managerLocked: false, deleted: false, lockoutEnd: farFuture).IsBlocked.ShouldBeFalse();
    }

    [Fact]
    public void AnAccountBuiltWithoutTheNewMarksIsNeitherLockedNorDeleted()
    {
        var account = new UserAccount(Guid.NewGuid(), "a@example.com", "A", "B", "Admin", true, true, true, null, false, null);

        account.IsManagerLocked.ShouldBeFalse();
        account.IsDeleted.ShouldBeFalse();
        account.IsBlocked.ShouldBeFalse();
    }

    [Fact]
    public void NewUserAccountCarriesItsValuesAndComparesByValue()
    {
        var account = new NewUserAccount("a@example.com", "A", "B", "Admin", null);

        account.Email.ShouldBe("a@example.com");
        account.FirstName.ShouldBe("A");
        account.LastName.ShouldBe("B");
        account.Role.ShouldBe("Admin");
        account.Password.ShouldBeNull();
        account.ShouldBe(new NewUserAccount("a@example.com", "A", "B", "Admin", null));
    }

    [Fact]
    public void FailedPasswordResultCarriesItsValues()
    {
        var end = new DateTimeOffset(2026, 10, 14, 12, 15, 0, TimeSpan.Zero);

        var locked = new FailedPasswordResult(true, end);
        var open = new FailedPasswordResult(false, null);

        locked.LockedNow.ShouldBeTrue();
        locked.LockoutEnd.ShouldBe(end);
        open.LockedNow.ShouldBeFalse();
        open.LockoutEnd.ShouldBeNull();
        PasswordCheck.Failed.ShouldNotBe(PasswordCheck.Succeeded);
    }

    private static UserAccount Account(bool isActive, bool managerLocked, bool deleted, DateTimeOffset? lockoutEnd = null) =>
        new(Guid.NewGuid(), "paolo@example.com", "Paolo", "Garcia", "Manager", isActive, true, true, null, false, lockoutEnd, managerLocked, deleted);
}
