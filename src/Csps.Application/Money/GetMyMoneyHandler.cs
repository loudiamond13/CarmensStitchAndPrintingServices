using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a staff member reads their own money on hand (MONEY-01). The person is the token's user, never an id from the request.
/// The balance is summed from the records on every read through the one domain formula.
/// </summary>
/// <param name="reader">The staff money read port.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="staff">Reads the caller's role and account flags.</param>
public sealed class GetMyMoneyHandler(IStaffMoneyReader reader, IRequestContext requestContext, IBusinessCalendar calendar, IStaffDirectory staff)
{
    /// <summary>Reads the caller's money on hand.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The caller's figure, or a 401 when the token names no usable account.</returns>
    public async Task<Result<StaffMoneyResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<StaffMoneyResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var sums = await reader.GetSumsAsync([callerId], cancellationToken).ConfigureAwait(false);
        var mine = sums.FirstOrDefault(row => row.UserId == callerId);
        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        if (mine is null || caller is null)
        {
            return Result.Failure<StaffMoneyResponse>(AuthErrors.SessionEnded);
        }

        var balance = mine.Balance();
        var status = MoneyParties.StatusWord(MoneyParties.From(caller, balance).Status);
        return Result.Success(new StaffMoneyResponse(mine.UserId, mine.Name, caller.Role ?? string.Empty, status, balance, clock.Today));
    }
}
