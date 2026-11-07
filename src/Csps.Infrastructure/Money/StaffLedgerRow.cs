namespace Csps.Infrastructure.Money;

/// <summary>One narrow ledger row: the same six same-typed columns for every source, so the sources join in one UNION ALL (MONEY-02).</summary>
/// <param name="Kind">The <see cref="Csps.Domain.Money.LedgerEntryKind"/> as its int value.</param>
/// <param name="SourceId">The id of the payment, refund, expense or transfer behind the row.</param>
/// <param name="Date">The day the money moved.</param>
/// <param name="RecordedAtUtc">When the row was recorded.</param>
/// <param name="Signed">The amount with its sign: plus for money in, minus for money out.</param>
/// <param name="Deleted">True for a deleted row; always false until transfers join the ledger.</param>
internal sealed record StaffLedgerRow(int Kind, Guid SourceId, DateOnly Date, DateTimeOffset RecordedAtUtc, decimal Signed, bool Deleted);
