using Csps.Application.Security;
using Csps.Application.Staff;

namespace Csps.Application.UnitTests.Staff;

/// <summary>CEXP-05, D-32: one rule says who can be named as the payer.</summary>
public sealed class StaffStateTests
{
    private static StaffState State(
        string? role = Roles.Manager, bool active = true, bool locked = false, bool deleted = false, bool hasPassword = true) =>
        new(Guid.NewGuid(), "Ana Abad", role, active, locked, deleted, hasPassword);

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public void AnActiveSetUpAdminOrManagerCanPay(string role)
    {
        State(role).CanPay.ShouldBeTrue();
    }

    [Fact]
    public void ADeactivatedPersonCannotPay()
    {
        State(active: false).CanPay.ShouldBeFalse();
    }

    [Fact]
    public void AManagerLockedPersonCannotPay()
    {
        State(locked: true).CanPay.ShouldBeFalse();
    }

    [Fact]
    public void ADeletedPersonCannotPay()
    {
        State(deleted: true).CanPay.ShouldBeFalse();
    }

    [Fact]
    public void AnInvitedPersonWithNoPasswordCannotPay()
    {
        State(hasPassword: false).CanPay.ShouldBeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Viewer")]
    [InlineData("manager")]
    public void ANullOrOtherRoleCannotPay(string? role)
    {
        State(role).CanPay.ShouldBeFalse();
    }

    [Fact]
    public void OnlyTheManagerRoleIsAManager()
    {
        State(Roles.Manager).IsManager.ShouldBeTrue();
        State(Roles.Admin).IsManager.ShouldBeFalse();
        State(null).IsManager.ShouldBeFalse();
    }
}
