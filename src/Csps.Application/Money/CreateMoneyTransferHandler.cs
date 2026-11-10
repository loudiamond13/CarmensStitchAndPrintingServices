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
/// Use case: a staff member transfers money on hand to a coworker (MONEY-04, MONEY-05). The sender is the token's user, never a value
/// from the request (CWE-639). Inside one transaction the <c>staff-money</c> lock is taken first, then both people and both balances
/// are read, then the domain decides every rule (D-14, D-19, D-20, D-49, D-56), so two transfers can never spend the same money twice
/// (D-53). Who recorded the transfer and when come from the token and the clock (SEC-08). One audit entry joins the save with the sender as actor and ids only (D-111, AUDIT-01).
/// </summary>
public sealed class CreateMoneyTransferHandler(
    IMoneyTransfers transfers,
    IStaffMoneyReader reader,
    IStaffMoneyLock moneyLock,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateMoneyTransferRequest> validator)
{
    /// <summary>Records the transfer.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The saved transfer and the sender's new balance, a 400 naming every field that failed, a 401 when the token names no usable
    /// account, or a 409 when the lock could not be had.
    /// </returns>
    public async Task<Result<MoneyTransferSavedResponse>> HandleAsync(CreateMoneyTransferRequest request, CancellationToken cancellationToken)
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
        Guid callerId, CreateMoneyTransferRequest request, DateOnly date, BusinessClock clock, CancellationToken cancellationToken)
    {
        await moneyLock.LockAsync(cancellationToken).ConfigureAwait(false);

        var recipientId = request.ToUserId!.Value;
        var senderState = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        // Read under the lock: a sender who left, was locked or lost the role since sign-in may not move money (D-17).
        if (senderState is not { IsActive: true, IsManagerLocked: false, IsDeleted: false, Role: Roles.Admin or Roles.Manager })
        {
            return Result.Failure<MoneyTransferSavedResponse>(AuthErrors.SessionEnded);
        }

        var recipientState = await staff.GetStaffStateAsync(recipientId, cancellationToken).ConfigureAwait(false);
        var sums = await reader.GetSumsAsync([.. new[] { callerId, recipientId }.Distinct()], cancellationToken).ConfigureAwait(false);
        var sender = MoneyParties.From(senderState, StaffMoneySums.BalanceOf(sums, callerId));
        var recipient = MoneyParties.From(recipientState, StaffMoneySums.BalanceOf(sums, recipientId));
        if (recipientState is null || recipient.Status is MoneyPartyStatus.NotStaff)
        {
            return MoneyRules.Reject<MoneyTransferSavedResponse>(MoneyRules.ToUserIdField, MoneyErrors.UnknownRecipientMessage);
        }

        var recorded = MoneyTransfer.Record(sender, recipient, request.Amount!.Value, date, request.Note, senderState.IsManager, clock.Today, clock.UtcNow);
        if (recorded.IsFailure)
        {
            return Result.Failure<MoneyTransferSavedResponse>(recorded.Error);
        }

        var transfer = recorded.Value;
        transfers.Add(transfer);
        audit.Record(
            AuditActions.MoneyTransferAdded,
            MoneyAuditTargets.Transfer,
            AuditKey.Of(transfer.Id),
            MoneyAuditDetail.Snapshot(transfer.FromUserId, transfer.ToUserId, transfer.Amount, transfer.TransferDate, hasNote: transfer.Note is not null));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var after = await reader.GetSumsAsync([callerId], cancellationToken).ConfigureAwait(false);
        var from = ToActor(senderState);
        var view = MoneyTransferResponse.Of(transfer, from, ToActor(recipientState), from, deletedBy: null);
        return Result.Success(new MoneyTransferSavedResponse(view, StaffMoneySums.BalanceOf(after, callerId)));
    }

    private static ActorRef ToActor(StaffState state) => new(state.Id, state.Name, state.IsDeleted);
}
