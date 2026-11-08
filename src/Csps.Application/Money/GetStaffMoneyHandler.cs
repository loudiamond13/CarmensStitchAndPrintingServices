using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;

namespace Csps.Application.Money;

/// <summary>
/// Use case: one person's money on hand (MONEY-03). An Admin may ask only for their own id; a Manager may ask for any staff member,
/// a former one included. The role is decided first, from the caller's own account, so an Admin learns nothing about anyone else.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="staff">Reads accounts and roles.</param>
/// <param name="calendar">The business calendar.</param>
public sealed class GetStaffMoneyHandler(IStaffMoneyReader reader, IRequestContext requestContext, IStaffDirectory staff, IBusinessCalendar calendar)
{
    /// <summary>Reads one person's money on hand.</summary>
    /// <param name="userId">The person asked about.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The figure, a 401 when the token names no usable account, a 403 for an Admin asking about someone else, or a 404 for a Manager asking about no staff member.</returns>
    public async Task<Result<StaffMoneyResponse>> HandleAsync(Guid userId, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<StaffMoneyResponse>(AuthErrors.SessionEnded);
        }

        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        if (caller is null)
        {
            return Result.Failure<StaffMoneyResponse>(AuthErrors.SessionEnded);
        }

        var access = StaffMoneyAccess.Check(callerId, caller, userId);
        if (access.IsFailure)
        {
            return Result.Failure<StaffMoneyResponse>(access.Error);
        }

        var found = await StaffMoneyAccess.FindAsync(staff, caller, userId, cancellationToken).ConfigureAwait(false);
        if (found.IsFailure)
        {
            return Result.Failure<StaffMoneyResponse>(found.Error);
        }

        var person = found.Value;
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var sums = await reader.GetSumsAsync([userId], cancellationToken).ConfigureAwait(false);
        var mine = sums.FirstOrDefault(row => row.UserId == userId);
        var balance = mine?.Balance() ?? 0m;
        var party = MoneyParties.From(person, balance);
        return Result.Success(new StaffMoneyResponse(userId, mine?.Name ?? person.Name, person.Role ?? string.Empty, MoneyParties.StatusWord(party.Status), balance, clock.Today));
    }
}
