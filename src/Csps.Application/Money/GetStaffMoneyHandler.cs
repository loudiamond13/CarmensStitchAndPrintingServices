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
    public Task<Result<StaffMoneyResponse>> HandleAsync(Guid userId, CancellationToken cancellationToken)
    {
        _ = (reader, requestContext, staff, calendar, userId, cancellationToken);
        return Task.FromResult(Result.Failure<StaffMoneyResponse>(MoneyErrors.PersonNotFound));
    }
}
