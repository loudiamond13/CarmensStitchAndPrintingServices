using Csps.Application.Money;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Domain.Identity;
using Csps.Domain.Money;

namespace Csps.Application.UnitTests.Money;

/// <summary>D-19, D-56: one rule turns an account into the party the transfer rules see.</summary>
public sealed class MoneyPartiesTests
{
    private static StaffState State(
        string? role = Roles.Manager, bool active = true, bool locked = false, bool deleted = false, bool finishedSetUp = true, Guid? id = null) =>
        new(id ?? Guid.NewGuid(), "Liza Mercado", role, active, locked, deleted, HasFinishedSetUp: finishedSetUp);

    [Fact]
    public void ANullStateIsNotStaffWithAnEmptyId()
    {
        var party = MoneyParties.From(null, 0m);

        party.Id.ShouldBe(Guid.Empty);
        party.Status.ShouldBe(MoneyPartyStatus.NotStaff);
    }

    [Fact]
    public void TheLegacyHolderIsNotStaff()
    {
        MoneyParties.From(State(Roles.Admin, id: LegacyHolder.Id), 0m).Status.ShouldBe(MoneyPartyStatus.NotStaff);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("Viewer")]
    public void AnAccountWithNoStaffRoleIsNotStaff(string? role)
    {
        MoneyParties.From(State(role), 0m).Status.ShouldBe(MoneyPartyStatus.NotStaff);
    }

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public void AnActiveAdminOrManagerIsActive(string role)
    {
        var state = State(role);

        var party = MoneyParties.From(state, 125.50m);

        party.Status.ShouldBe(MoneyPartyStatus.Active);
        party.Id.ShouldBe(state.Id);
        party.Name.ShouldBe("Liza Mercado");
        party.Balance.ShouldBe(125.50m);
    }

    [Fact]
    public void ALockedManagerIsActive()
    {
        MoneyParties.From(State(locked: true), 0m).Status.ShouldBe(MoneyPartyStatus.Active);
    }

    [Fact]
    public void ALockedAdminIsActive()
    {
        MoneyParties.From(State(Roles.Admin, locked: true), 0m).Status.ShouldBe(MoneyPartyStatus.Active);
    }

    [Fact]
    public void APersonWhoHasNotSetUpYetIsActive()
    {
        MoneyParties.From(State(finishedSetUp: false), 0m).Status.ShouldBe(MoneyPartyStatus.Active);
    }

    [Fact]
    public void ADeactivatedPersonIsDeactivated()
    {
        MoneyParties.From(State(active: false), -200m).Status.ShouldBe(MoneyPartyStatus.Deactivated);
    }

    [Fact]
    public void ADeletedPersonIsDeletedEvenWhenAlsoDeactivated()
    {
        MoneyParties.From(State(active: false, deleted: true), -200m).Status.ShouldBe(MoneyPartyStatus.Deleted);
    }

    [Fact]
    public void ADeletedPersonWhoIsStillMarkedActiveIsDeleted()
    {
        MoneyParties.From(State(deleted: true), 0m).Status.ShouldBe(MoneyPartyStatus.Deleted);
    }

    [Fact]
    public void AFormerStaffMemberWithNoStaffRoleIsStillNotStaff()
    {
        MoneyParties.From(State(null, active: false, deleted: true), 0m).Status.ShouldBe(MoneyPartyStatus.NotStaff);
    }
}
