using Csps.Application.Users;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>One page of a person's ledger, newest first, with their money on hand (MONEY-02, D-41).</summary>
/// <param name="Items">The rows of this page.</param>
/// <param name="Total">How many rows the ledger has across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
/// <param name="Balance">The person's money on hand now, worked out on the server.</param>
/// <param name="IncludesDeleted">True when deleted transfers are in the page (a Manager asked for them).</param>
public sealed record LedgerPageResponse(IReadOnlyList<LedgerEntryResponse> Items, int Total, int Page, int PageSize, decimal Balance, bool IncludesDeleted);

/// <summary>
/// One ledger row. A row has either money in or money out, never both. Only the details its kind names are filled; the rest are null.
/// A deleted transfer shows its face amount and no balance after it, because it counts toward no balance.
/// </summary>
/// <param name="Kind">One of <c>payment-received</c>, <c>refund-handed-back</c>, <c>transfer-in</c>, <c>transfer-out</c>, <c>company-expense</c>, <c>order-expense</c>.</param>
/// <param name="Date">The day the money moved.</param>
/// <param name="RecordedAtUtc">When the row was recorded.</param>
/// <param name="MoneyIn">The amount in pesos for money in; null for money out.</param>
/// <param name="MoneyOut">The amount in pesos for money out; null for money in.</param>
/// <param name="BalanceAfter">The person's balance after this row, like a bank statement; null for a deleted transfer.</param>
/// <param name="OrderId">The order behind a payment, refund or order expense.</param>
/// <param name="OrderNumber">That order's number.</param>
/// <param name="Team">That order's team or club name.</param>
/// <param name="Customer">That order's customer name.</param>
/// <param name="PaymentMethod">The payment method of a payment.</param>
/// <param name="Category">The category of a company or order expense.</param>
/// <param name="Description">What a company or order expense was for.</param>
/// <param name="Counterpart">The other person on a transfer.</param>
/// <param name="Note">The note of a transfer.</param>
/// <param name="TransferId">The id of a transfer row.</param>
/// <param name="Version">The base64 row version of a transfer.</param>
/// <param name="IsHandover">True for a transfer a Manager recorded for a former staff member.</param>
/// <param name="RecordedBy">Who recorded a transfer.</param>
/// <param name="IsDeleted">True for a deleted transfer.</param>
/// <param name="DeletedBy">Who deleted a transfer.</param>
/// <param name="DeletedAtUtc">When a transfer was deleted.</param>
public sealed record LedgerEntryResponse(
    string Kind,
    DateOnly Date,
    DateTimeOffset RecordedAtUtc,
    decimal? MoneyIn,
    decimal? MoneyOut,
    decimal? BalanceAfter,
    Guid? OrderId,
    string? OrderNumber,
    string? Team,
    string? Customer,
    string? PaymentMethod,
    string? Category,
    string? Description,
    ActorRef? Counterpart,
    string? Note,
    Guid? TransferId,
    string? Version,
    bool IsHandover,
    ActorRef? RecordedBy,
    bool IsDeleted,
    ActorRef? DeletedBy,
    DateTimeOffset? DeletedAtUtc)
{
    /// <summary>Builds the response row from a read row and its balance.</summary>
    /// <param name="row">The row with its details.</param>
    /// <param name="balanceAfter">The balance after the row; null for a deleted transfer.</param>
    /// <returns>The response row.</returns>
    public static LedgerEntryResponse Of(LedgerRowView row, decimal? balanceAfter)
    {
        ArgumentNullException.ThrowIfNull(row);
        var isTransfer = row.Kind is LedgerEntryKind.TransferIn or LedgerEntryKind.TransferOut;
        var isIn = row.Kind is LedgerEntryKind.PaymentReceived or LedgerEntryKind.TransferIn;
        var amount = row.IsDeleted ? row.DeletedAmount ?? 0m : Math.Abs(row.SignedAmount);
        return new LedgerEntryResponse(
            WordOf(row.Kind),
            row.Date,
            row.RecordedAtUtc,
            isIn ? amount : null,
            isIn ? null : amount,
            balanceAfter,
            row.OrderId,
            row.OrderNumber,
            row.Team,
            row.Customer,
            row.PaymentMethod,
            row.Category,
            row.Description,
            row.Counterpart,
            row.Note,
            isTransfer ? row.SourceId : null,
            row.Version,
            row.IsHandover,
            row.RecordedBy,
            row.IsDeleted,
            row.DeletedBy,
            row.DeletedAtUtc);
    }

    private static string WordOf(LedgerEntryKind kind) => kind switch
    {
        LedgerEntryKind.PaymentReceived => "payment-received",
        LedgerEntryKind.RefundHandedBack => "refund-handed-back",
        LedgerEntryKind.TransferIn => "transfer-in",
        LedgerEntryKind.TransferOut => "transfer-out",
        LedgerEntryKind.CompanyExpensePaid => "company-expense",
        LedgerEntryKind.OrderExpensePaid => "order-expense",
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown ledger row kind."),
    };
}
