using Csps.Domain.Common;

namespace Csps.Domain.Money;

/// <summary>
/// Money one staff member sent to another (MONEY-04), or money a Manager handed from former staff to a coworker (D-17). Once
/// recorded nothing about it changes; a wrong transfer is deleted and recorded again (D-22). The attribution members are set only
/// by the database layer from the token and the clock (SEC-08).
/// </summary>
public sealed class MoneyTransfer : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by the factories.
    private MoneyTransfer(Guid id, Guid fromUserId, Guid toUserId, decimal amount, DateOnly transferDate, string? note, bool isHandover)
    {
        Id = id;
        FromUserId = fromUserId;
        ToUserId = toUserId;
        Amount = amount;
        TransferDate = transferDate;
        Note = note;
        IsHandover = isHandover;
        RowVersion = [];
    }

    /// <summary>Primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>The sender, stored on every transfer; for a hand-over this is the former staff member.</summary>
    public Guid FromUserId { get; private set; }

    /// <summary>The recipient.</summary>
    public Guid ToUserId { get; private set; }

    /// <summary>The amount in pesos, more than zero.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The day the money changed hands, in the business calendar.</summary>
    public DateOnly TransferDate { get; private set; }

    /// <summary>Optional note, trimmed; null when empty.</summary>
    public string? Note { get; private set; }

    /// <summary>True when a Manager recorded this for a former staff member (D-17).</summary>
    public bool IsHandover { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Who soft-deleted it; null while it counts.</summary>
    public Guid? DeletedById { get; private set; }

    /// <summary>When the transfer was soft-deleted; null while it counts.</summary>
    public DateTimeOffset? DeletedAtUtc { get; private set; }

    /// <summary>The row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>True once the transfer is soft-deleted.</summary>
    public bool IsDeleted => DeletedAtUtc is not null;

    /// <summary>Records a transfer from one staff member to another, checking every rule again so no caller can skip one.</summary>
    /// <param name="sender">The sender with the balance the handler read under the lock.</param>
    /// <param name="recipient">The recipient with their status and balance.</param>
    /// <param name="amount">The amount; at least 0.01, at most two decimals, at most the sender's balance.</param>
    /// <param name="transferDate">The day the money changed hands; today or earlier.</param>
    /// <param name="note">Optional note; at most 200 characters after trimming.</param>
    /// <param name="callerIsManager">True when the signed-in user is a Manager, who may read a leaver's figure.</param>
    /// <param name="today">The business today.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved transfer, or a validation error naming the broken field.</returns>
    public static Result<MoneyTransfer> Record(
        MoneyParty sender,
        MoneyParty recipient,
        decimal amount,
        DateOnly transferDate,
        string? note,
        bool callerIsManager,
        DateOnly today,
        DateTimeOffset now)
    {
        if (recipient.Id == Guid.Empty)
        {
            return MoneyRules.Reject<MoneyTransfer>(MoneyRules.ToUserIdField, MoneyRules.ToRequired);
        }

        if (recipient.Id == sender.Id)
        {
            return MoneyRules.Reject<MoneyTransfer>(MoneyRules.ToUserIdField, MoneyRules.ToSelf);
        }

        var checkedNote = CheckFields(amount, transferDate, note, today);
        if (checkedNote.IsFailure)
        {
            return Result.Failure<MoneyTransfer>(checkedNote.Error);
        }

        // Former staff can receive only while they are owed money (D-19).
        var canReceive = recipient.Status is MoneyPartyStatus.Active || (recipient.IsLeaver && recipient.Balance < 0m);
        if (!canReceive)
        {
            return MoneyRules.Reject<MoneyTransfer>(MoneyRules.ToUserIdField, MoneyRules.RecipientUnavailable(recipient.Name));
        }

        if (sender.Balance <= 0m)
        {
            return MoneyRules.Reject<MoneyTransfer>(MoneyRules.AmountField, MoneyRules.NothingOnHand);
        }

        if (amount > sender.Balance)
        {
            return MoneyRules.Reject<MoneyTransfer>(MoneyRules.AmountField, MoneyRules.AboveBalance(sender.Balance));
        }

        if (recipient.IsLeaver && amount > -recipient.Balance)
        {
            // An Admin learns the bound exists but not the figure (D-49).
            return MoneyRules.Reject<MoneyTransfer>(
                MoneyRules.AmountField,
                callerIsManager ? MoneyRules.OwedOnlyForManager(recipient.Name, -recipient.Balance) : MoneyRules.OwedForAdmin(recipient.Name));
        }

        return Result.Success(new MoneyTransfer(Guid.CreateVersion7(now), sender.Id, recipient.Id, amount, transferDate, checkedNote.Value, isHandover: false));
    }

    /// <summary>Records a hand-over: a Manager moves money held by a former staff member to a current coworker (D-17, D-18).</summary>
    /// <param name="leaver">The former staff member who holds the money, with the balance read under the lock.</param>
    /// <param name="recipient">The current coworker who receives it.</param>
    /// <param name="amount">The amount; at least 0.01, at most two decimals, at most what the former staff member holds.</param>
    /// <param name="transferDate">The day the money changed hands; today or earlier.</param>
    /// <param name="note">Optional note; at most 200 characters after trimming.</param>
    /// <param name="today">The business today.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved hand-over, or a validation error naming the broken field.</returns>
    public static Result<MoneyTransfer> RecordHandover(
        MoneyParty leaver,
        MoneyParty recipient,
        decimal amount,
        DateOnly transferDate,
        string? note,
        DateOnly today,
        DateTimeOffset now) =>
        Result.Failure<MoneyTransfer>(Error.BusinessRule("money-transfers.not-built", "Not built yet."));

    /// <summary>Soft-deletes the transfer so it stops counting in any balance (D-23). A second call changes nothing.</summary>
    /// <param name="by">The Manager who deleted it.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>True when it was deleted now; false when it was already deleted.</returns>
    public bool SoftDelete(Guid by, DateTimeOffset now) => IsDeleted && by == Guid.Empty && now == default;

    /// <summary>Checks that the transfer may be removed for good: it must be in the bin first (D-24).</summary>
    /// <returns>Success, or the business rule that says to delete it first.</returns>
    public Result EnsureRemovable() => IsDeleted ? Result.Success() : Result.Success();

    // Checks the amount, date and note in that order; returns the trimmed note, or null when it is blank.
    private static Result<string?> CheckFields(decimal amount, DateOnly transferDate, string? note, DateOnly today)
    {
        if (amount <= 0m)
        {
            return MoneyRules.Reject<string?>(MoneyRules.AmountField, MoneyRules.AmountTooSmall);
        }

        if (!MoneyRules.HasValidScale(amount))
        {
            return MoneyRules.Reject<string?>(MoneyRules.AmountField, MoneyRules.AmountDecimals);
        }

        if (transferDate > today)
        {
            return MoneyRules.Reject<string?>(MoneyRules.TransferDateField, MoneyRules.DateInFuture);
        }

        var trimmedNote = note?.Trim();
        if (trimmedNote is { Length: > MoneyRules.NoteMaxLength })
        {
            return MoneyRules.Reject<string?>(MoneyRules.NoteField, MoneyRules.NoteTooLong);
        }

        return Result.Success<string?>(string.IsNullOrEmpty(trimmedNote) ? null : trimmedNote);
    }
}
