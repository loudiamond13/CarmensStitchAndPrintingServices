using Csps.Application.Ports;
using Csps.Application.Staff;
using Csps.Domain.Common;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>The one role-before-existence rule for every staff money read that names a person (MONEY-03, OD-19).</summary>
public static class StaffMoneyAccess
{
    /// <summary>
    /// Decides from the caller's own account whether they may read the requested person's money. Nothing about the requested person
    /// is looked up, so a refusal is the same for a real coworker and a made-up id (CWE-639, CWE-204).
    /// </summary>
    /// <param name="callerId">The signed-in user.</param>
    /// <param name="caller">The signed-in user's account state; null when it is unknown.</param>
    /// <param name="requestedId">The person asked about.</param>
    /// <returns>Success, or <see cref="MoneyErrors.Forbidden"/> for anyone but a Manager asking about someone else.</returns>
    public static Result Check(Guid callerId, StaffState? caller, Guid requestedId) =>
        requestedId == callerId || caller?.IsManager == true ? Result.Success() : Result.Failure(MoneyErrors.Forbidden);

    /// <summary>
    /// Finds the person a call that passed <see cref="Check"/> asks about. The caller's own account is used as it is; anyone else must
    /// be an Admin or Manager account, current or former, and not the legacy holder.
    /// </summary>
    /// <param name="staff">Reads accounts and roles.</param>
    /// <param name="caller">The signed-in user's account state.</param>
    /// <param name="requestedId">The person asked about.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The person's account state, or <see cref="MoneyErrors.PersonNotFound"/>.</returns>
    public static async Task<Result<StaffState>> FindAsync(IStaffDirectory staff, StaffState caller, Guid requestedId, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(staff);
        ArgumentNullException.ThrowIfNull(caller);
        if (requestedId == caller.Id)
        {
            return Result.Success(caller);
        }

        var state = await staff.GetStaffStateAsync(requestedId, cancellationToken).ConfigureAwait(false);
        return state is not null && MoneyParties.From(state, 0m).Status is not MoneyPartyStatus.NotStaff
            ? Result.Success(state)
            : Result.Failure<StaffState>(MoneyErrors.PersonNotFound);
    }
}
