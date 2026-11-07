namespace Csps.Infrastructure.Money;

/// <summary>
/// One narrow ledger row: the same six same-typed columns for every source, so the sources join in one UNION ALL (MONEY-02). It is
/// filled by member initializers because EF Core refuses a set operation over constructor projections.
/// </summary>
internal sealed record StaffLedgerRow
{
    /// <summary>Gets the <see cref="Csps.Domain.Money.LedgerEntryKind"/> as its int value.</summary>
    public int Kind { get; init; }

    /// <summary>Gets the id of the payment, refund, expense or transfer behind the row.</summary>
    public Guid SourceId { get; init; }

    /// <summary>Gets the day the money moved.</summary>
    public DateOnly Date { get; init; }

    /// <summary>Gets when the row was recorded.</summary>
    public DateTimeOffset RecordedAtUtc { get; init; }

    /// <summary>Gets the amount with its sign: plus for money in, minus for money out.</summary>
    public decimal Signed { get; init; }

    /// <summary>Gets a value indicating whether the row is deleted; always false until transfers join the ledger.</summary>
    public bool Deleted { get; init; }
}
