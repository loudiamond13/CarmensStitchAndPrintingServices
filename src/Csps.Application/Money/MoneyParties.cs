using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Domain.Identity;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>Turns a person's account state and balance into the party the transfer rules see (D-19, D-56).</summary>
public static class MoneyParties
{
    /// <summary>
    /// Maps an account to a transfer party. No account, the legacy holder and an account without the Admin or Manager role are
    /// <see cref="MoneyPartyStatus.NotStaff"/>. Deleted is checked before deactivated. A Manager-locked or not-yet-set-up active
    /// person is <see cref="MoneyPartyStatus.Active"/>, not a stranger (D-56).
    /// </summary>
    /// <param name="state">The account, or null when no such account exists.</param>
    /// <param name="balance">The person's money on hand.</param>
    /// <returns>The party; its id is empty when there is no account.</returns>
    public static MoneyParty From(StaffState? state, decimal balance)
    {
        if (state is null)
        {
            return new MoneyParty(Guid.Empty, string.Empty, MoneyPartyStatus.NotStaff, balance);
        }

        if (state.Id == LegacyHolder.Id || state.Role is not (Roles.Admin or Roles.Manager))
        {
            return new MoneyParty(state.Id, state.Name, MoneyPartyStatus.NotStaff, balance);
        }

        return new MoneyParty(state.Id, state.Name, StatusOf(state.IsActive, state.IsDeleted), balance);
    }

    /// <summary>
    /// Maps an Admin or Manager from the recipients list to a transfer party. The reader already left out the legacy holder and
    /// accounts without the role, so the status is Active, Deactivated or Deleted, with the same rules as <see cref="From"/>.
    /// </summary>
    /// <param name="person">The Admin or Manager.</param>
    /// <param name="balance">The person's money on hand.</param>
    /// <returns>The party.</returns>
    public static MoneyParty FromPerson(StaffPerson person, decimal balance)
    {
        ArgumentNullException.ThrowIfNull(person);
        return new MoneyParty(person.Id, person.Name, StatusOf(person.IsActive, person.IsDeleted), balance);
    }

    // Deleted is checked before deactivated.
    private static MoneyPartyStatus StatusOf(bool isActive, bool isDeleted) =>
        isDeleted ? MoneyPartyStatus.Deleted : isActive ? MoneyPartyStatus.Active : MoneyPartyStatus.Deactivated;
}
