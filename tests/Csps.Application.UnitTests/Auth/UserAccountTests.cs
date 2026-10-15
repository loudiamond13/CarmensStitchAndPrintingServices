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
}
