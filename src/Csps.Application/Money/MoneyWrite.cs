using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Money;
using Csps.Domain.Time;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// The flow the two money create use cases share (D-53): the session check, one clock read, the form check with the business today,
/// then the work inside one transaction with a retry after a lost race and a busy answer when the <c>staff-money</c> lock cannot be
/// had. A rule change for the flow, such as a new refusal on busy, is made here once.
/// </summary>
public static class MoneyWrite
{
    /// <summary>Checks the session and the form, then runs <paramref name="attempt"/> in one transaction.</summary>
    /// <typeparam name="TRequest">The form type.</typeparam>
    /// <param name="request">The form.</param>
    /// <param name="transferDate">The form's transfer date text, read after the form passed its check.</param>
    /// <param name="validator">Checks the form; the business today is passed under <see cref="CreateMoneyTransferRequestValidator.TodayKey"/>.</param>
    /// <param name="calendar">The business calendar.</param>
    /// <param name="requestContext">The signed-in user.</param>
    /// <param name="unitOfWork">Runs the transaction.</param>
    /// <param name="attempt">Takes the lock, reads, decides and saves; it gets the caller, the parsed date and the clock.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A 401 when the token names no user, a 400 naming every failed field, a 409 when busy, or the answer of <paramref name="attempt"/>.</returns>
    public static async Task<Result<MoneyTransferSavedResponse>> RunLockedAsync<TRequest>(
        TRequest request,
        string? transferDate,
        IValidator<TRequest> validator,
        IBusinessCalendar calendar,
        IRequestContext requestContext,
        IUnitOfWork unitOfWork,
        Func<Guid, DateOnly, BusinessClock, CancellationToken, Task<Result<MoneyTransferSavedResponse>>> attempt,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(validator);
        ArgumentNullException.ThrowIfNull(calendar);
        ArgumentNullException.ThrowIfNull(requestContext);
        ArgumentNullException.ThrowIfNull(unitOfWork);
        ArgumentNullException.ThrowIfNull(attempt);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<MoneyTransferSavedResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<TRequest>(request);
        context.RootContextData[CreateMoneyTransferRequestValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<MoneyTransferSavedResponse>(ValidationResults.ToError(validation, MoneyRules.InvalidCode, MoneyRules.InvalidMessage));
        }

        _ = CreateMoneyTransferRequestValidator.TryParseDate(transferDate, out var date);
        try
        {
            return await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => attempt(callerId, date, clock, token), cancellationToken),
                    Result.Failure<MoneyTransferSavedResponse>(MoneyErrors.Busy))
                .ConfigureAwait(false);
        }
        catch (StaffMoneyBusyException)
        {
            return Result.Failure<MoneyTransferSavedResponse>(MoneyErrors.Busy);
        }
    }
}
