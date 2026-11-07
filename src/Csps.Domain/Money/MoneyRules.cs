using Csps.Domain.Common;
using Csps.Domain.Orders;

namespace Csps.Domain.Money;

/// <summary>
/// The limits, field names, codes and plain-English messages of a staff money transfer (MONEY-04, D-14 to D-24), shared by the
/// domain, the validators and the tests so every layer says the same words. Peso figures passed to a message are always positive.
/// </summary>
public static class MoneyRules
{
    /// <summary>The longest note, in UTF-16 code units after trimming (the same measure as a browser string length).</summary>
    public const int NoteMaxLength = 200;

    /// <summary>The most decimal places an amount may have.</summary>
    public const int AmountScale = 2;

    /// <summary>The field name of the recipient.</summary>
    public const string ToUserIdField = "toUserId";

    /// <summary>The field name of the sender.</summary>
    public const string FromUserIdField = "fromUserId";

    /// <summary>The field name of the amount.</summary>
    public const string AmountField = "amount";

    /// <summary>The field name of the date.</summary>
    public const string TransferDateField = "transferDate";

    /// <summary>The field name of the note.</summary>
    public const string NoteField = "note";

    /// <summary>The date format of the wire and the audit log.</summary>
    public const string DateFormat = "yyyy-MM-dd";

    /// <summary>The machine code of a transfer that breaks field or balance rules.</summary>
    public const string InvalidCode = "money-transfers.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The machine code of a remove that is refused because the transfer is not in the bin (D-24).</summary>
    public const string NotDeletedCode = "money-transfers.not-deleted";

    /// <summary>The message for a missing recipient.</summary>
    public const string ToRequired = "Choose who got the cash.";

    /// <summary>The message for a recipient who is the sender.</summary>
    public const string ToSelf = "Choose someone other than yourself.";

    /// <summary>The message for a hand-over recipient who is the former staff member.</summary>
    /// <param name="name">The former staff member's name.</param>
    /// <returns>The message.</returns>
    public static string ToSelfHandover(string name) => $"Choose someone other than {name}.";

    /// <summary>The message for a recipient who cannot receive now (D-19, D-56).</summary>
    /// <param name="name">The recipient's name.</param>
    /// <returns>The message.</returns>
    public static string RecipientUnavailable(string name) => $"{name} can't receive transfers now. Choose someone else.";

    /// <summary>The message for a missing amount.</summary>
    public const string AmountRequired = "Enter the amount.";

    /// <summary>The message for an amount below one centavo.</summary>
    public const string AmountTooSmall = "Enter an amount of at least ₱0.01.";

    /// <summary>The message for an amount with more than two decimal places.</summary>
    public const string AmountDecimals = "Use at most 2 decimal places.";

    /// <summary>The message for a sender with nothing to send (D-14).</summary>
    public const string NothingOnHand = "You have nothing on hand to transfer.";

    /// <summary>The message for an amount above the sender's balance (D-14).</summary>
    /// <param name="balance">The sender's balance, positive.</param>
    /// <returns>The message.</returns>
    public static string AboveBalance(decimal balance) => $"You only have {Pesos.Format(balance)} on hand.";

    /// <summary>The message for a former staff member with nothing to hand over (D-18).</summary>
    /// <param name="name">The former staff member's name.</param>
    /// <returns>The message.</returns>
    public static string LeaverNothingOnHand(string name) => $"{name} has nothing on hand to hand over.";

    /// <summary>The message for a hand-over above what the former staff member holds (D-18).</summary>
    /// <param name="name">The former staff member's name.</param>
    /// <param name="balance">What they hold, positive.</param>
    /// <returns>The message.</returns>
    public static string LeaverAboveBalance(string name, decimal balance) => $"{name} only has {Pesos.Format(balance)} on hand.";

    /// <summary>The message a Manager reads when a transfer into a leaver is above what they are owed (D-49).</summary>
    /// <param name="name">The former staff member's name.</param>
    /// <param name="owed">What they are owed, positive.</param>
    /// <returns>The message.</returns>
    public static string OwedOnlyForManager(string name, decimal owed) => $"{name} is owed only {Pesos.Format(owed)}. Enter that or less.";

    /// <summary>The message an Admin reads for the same refusal: it names the person and no figure (D-49).</summary>
    /// <param name="name">The former staff member's name.</param>
    /// <returns>The message.</returns>
    public static string OwedForAdmin(string name) => $"That's more than {name} is owed. Ask a Manager for the amount.";

    /// <summary>The message for a hand-over whose sender is current staff (D-17).</summary>
    public const string HandoverSenderActive = "Only money held by former staff can be handed over.";

    /// <summary>The message for a missing date.</summary>
    public const string DateRequired = "Enter the transfer date.";

    /// <summary>The message for a date that is not a real calendar day.</summary>
    public const string DateInvalid = "Enter a real date.";

    /// <summary>The message for a date after the business today (D-20).</summary>
    public const string DateInFuture = "The transfer date can't be in the future.";

    /// <summary>The message for a note over the limit.</summary>
    public const string NoteTooLong = "Keep the note to 200 characters or fewer.";

    /// <summary>The message for removing a transfer that is not in the bin (D-24).</summary>
    public const string DeleteFirst = "Delete the transfer first.";

    /// <summary>Tells whether an amount has no more than <see cref="AmountScale"/> decimal places.</summary>
    /// <param name="amount">The amount.</param>
    /// <returns>True when rounding to two places changes nothing.</returns>
    public static bool HasValidScale(decimal amount) => decimal.Round(amount, AmountScale) == amount;

    /// <summary>Builds a validation failure that names one field.</summary>
    /// <typeparam name="T">The value type of the failed result.</typeparam>
    /// <param name="field">The field name.</param>
    /// <param name="message">The message under the field.</param>
    /// <returns>The failed result.</returns>
    public static Result<T> Reject<T>(string field, string message) =>
        Result.Failure<T>(Error.Validation(InvalidCode, InvalidMessage, new Dictionary<string, string[]> { [field] = [message] }));
}
