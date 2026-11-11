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
    /// Maps an Admin or Manager from the recipients list to a transfer party, with the same status rules as <see cref="From"/>. The
    /// legacy holder is <see cref="MoneyPartyStatus.NotStaff"/> here too, so it stays out of the list even if the reader returned it.
    /// </summary>
    /// <param name="person">The Admin or Manager.</param>
    /// <param name="balance">The person's money on hand.</param>
    /// <returns>The party.</returns>
    public static MoneyParty FromPerson(StaffPerson person, decimal balance)
    {
        ArgumentNullException.ThrowIfNull(person);
        var status = person.Id == LegacyHolder.Id ? MoneyPartyStatus.NotStaff : StatusOf(person.IsActive, person.IsDeleted);
        return new MoneyParty(person.Id, person.Name, status, balance);
    }

    /// <summary>Names a party's status the way the money answers do.</summary>
    /// <param name="status">The party status.</param>
    /// <returns><c>deleted</c>, <c>deactivated</c> or <c>active</c>; a party that is not staff reads as <c>active</c>, so callers filter those out first.</returns>
    public static string StatusWord(MoneyPartyStatus status) => status switch
    {
        MoneyPartyStatus.Deleted => TransferRecipientResponse.DeletedStatus,
        MoneyPartyStatus.Deactivated => TransferRecipientResponse.DeactivatedStatus,
        _ => TransferRecipientResponse.ActiveStatus,
    };

    // Deleted is checked before deactivated.
    private static MoneyPartyStatus StatusOf(bool isActive, bool isDeleted) =>
        isDeleted ? MoneyPartyStatus.Deleted : isActive ? MoneyPartyStatus.Active : MoneyPartyStatus.Deactivated;
}
