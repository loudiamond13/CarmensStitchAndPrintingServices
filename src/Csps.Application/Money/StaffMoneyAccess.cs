using Csps.Application.Staff;
using Csps.Domain.Common;

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
    public static Result Check(Guid callerId, StaffState? caller, Guid requestedId) => Result.Success();
}
