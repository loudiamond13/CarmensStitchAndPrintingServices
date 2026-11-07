using Csps.Application.Staff;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>Turns a person's account state and balance into the party the transfer rules see (D-19, D-56).</summary>
public static class MoneyParties
{
    /// <summary>
    /// Maps an account to a transfer party. Deleted is checked before deactivated. A Manager-locked or not-yet-set-up active person is
    /// <see cref="MoneyPartyStatus.Active"/>, not a stranger (D-56).
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

        var status = state.IsDeleted
            ? MoneyPartyStatus.Deleted
            : state.IsActive ? MoneyPartyStatus.Active : MoneyPartyStatus.Deactivated;
        return new MoneyParty(state.Id, state.Name, status, balance);
    }
}
