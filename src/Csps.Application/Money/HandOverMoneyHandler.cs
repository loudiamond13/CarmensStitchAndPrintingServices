using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Money;
using Csps.Domain.Time;
using FluentValidation;

namespace Csps.Application.Money;

/// <summary>
/// Use case: a Manager hands money held by a former staff member to a current coworker (D-17, D-18, MONEY-06). The former staff member
/// comes from the form; the Manager is the token's user and is read again under the lock. Inside one transaction the
/// <c>staff-money</c> lock is taken first, then the three people and the two balances are read, then the domain decides every rule,
/// so a hand-over and a transfer can never spend the same money twice (D-53). One audit entry joins the save with the Manager as
/// actor and ids only (D-52, AUDIT-01).
/// </summary>
public sealed class HandOverMoneyHandler(
    IMoneyTransfers transfers,
    IStaffMoneyReader reader,
    IStaffMoneyLock moneyLock,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateMoneyHandoverRequest> validator)
{
    /// <summary>Records the hand-over.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The saved hand-over and the former staff member's new balance, a 400 naming every field that failed, a 401 when the token names
    /// no usable Manager, or a 409 when the lock could not be had.
    /// </returns>
    public async Task<Result<MoneyTransferSavedResponse>> HandleAsync(CreateMoneyHandoverRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        return await MoneyWrite
            .RunLockedAsync(
                request,
                request.TransferDate,
                validator,
                calendar,
                requestContext,
                unitOfWork,
                (callerId, date, clock, token) => AttemptAsync(callerId, request, date, clock, token),
                cancellationToken)
            .ConfigureAwait(false);
    }

    // The lock comes first: every read below happens after it, so the balances cannot change until this transaction ends.
    private async Task<Result<MoneyTransferSavedResponse>> AttemptAsync(
        Guid callerId, CreateMoneyHandoverRequest request, DateOnly date, BusinessClock clock, CancellationToken cancellationToken)
    {
        await moneyLock.LockAsync(cancellationToken).ConfigureAwait(false);

        var callerState = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        // Read under the lock: a Manager who left, was locked or lost the role since sign-in may not move money.
        if (callerState is not { IsActive: true, IsManagerLocked: false, IsDeleted: false, Role: Roles.Manager })
        {
            return Result.Failure<MoneyTransferSavedResponse>(AuthErrors.SessionEnded);
        }

        var leaverId = request.FromUserId!.Value;
        var recipientId = request.ToUserId!.Value;
        var leaverState = await staff.GetStaffStateAsync(leaverId, cancellationToken).ConfigureAwait(false);
        var recipientState = await staff.GetStaffStateAsync(recipientId, cancellationToken).ConfigureAwait(false);
        var sums = await reader.GetSumsAsync([.. new[] { leaverId, recipientId }.Distinct()], cancellationToken).ConfigureAwait(false);
        var leaver = MoneyParties.From(leaverState, StaffMoneySums.BalanceOf(sums, leaverId));
        var recipient = MoneyParties.From(recipientState, StaffMoneySums.BalanceOf(sums, recipientId));
        if (recipientState is null || recipient.Status is MoneyPartyStatus.NotStaff)
        {
            return MoneyRules.Reject<MoneyTransferSavedResponse>(MoneyRules.ToUserIdField, MoneyErrors.UnknownRecipientMessage);
        }

        var recorded = MoneyTransfer.RecordHandover(leaver, recipient, request.Amount!.Value, date, request.Note, clock.Today, clock.UtcNow);
        if (recorded.IsFailure)
        {
            return Result.Failure<MoneyTransferSavedResponse>(recorded.Error);
        }

        var transfer = recorded.Value;
        transfers.Add(transfer);
        audit.Record(
            AuditActions.MoneyHandedOver,
            MoneyAuditTargets.Transfer,
            AuditKey.Of(transfer.Id),
            MoneyAuditDetail.Handover(transfer.FromUserId, transfer.ToUserId, transfer.Amount, transfer.TransferDate, hasNote: transfer.Note is not null));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var after = await reader.GetSumsAsync([leaverId], cancellationToken).ConfigureAwait(false);
        var view = MoneyTransferResponse.Of(transfer, ToActor(leaverState!), ToActor(recipientState), ToActor(callerState), deletedBy: null);
        return Result.Success(new MoneyTransferSavedResponse(view, StaffMoneySums.BalanceOf(after, leaverId)));
    }

    private static ActorRef ToActor(StaffState state) => new(state.Id, state.Name, state.IsDeleted);
}
