using Csps.Application.Users;
using Csps.Domain.Money;

namespace Csps.Application.Money;

/// <summary>
/// One ledger row as the read port returns it: the narrow row from the union plus the details its kind names (MONEY-02). A deleted
/// transfer has <see cref="SignedAmount"/> 0, so it adds to no balance; its face amount is in <see cref="DeletedAmount"/>.
/// </summary>
/// <param name="Kind">The kind of row.</param>
/// <param name="SourceId">The id of the payment, refund, expense or transfer behind the row.</param>
/// <param name="Date">The day the money moved.</param>
/// <param name="RecordedAtUtc">When the row was recorded.</param>
/// <param name="SignedAmount">The amount with its sign: plus for money in, minus for money out, 0 for a deleted transfer.</param>
/// <param name="IsDeleted">True for a deleted transfer; such a row counts toward no balance.</param>
public sealed record LedgerRowView(LedgerEntryKind Kind, Guid SourceId, DateOnly Date, DateTimeOffset RecordedAtUtc, decimal SignedAmount, bool IsDeleted)
{
    /// <summary>Gets the face amount of a deleted transfer, which <see cref="SignedAmount"/> leaves out; null for a counted row.</summary>
    public decimal? DeletedAmount { get; init; }

    /// <summary>Gets the order behind a payment, refund or order expense.</summary>
    public Guid? OrderId { get; init; }

    /// <summary>Gets the number of that order.</summary>
    public string? OrderNumber { get; init; }

    /// <summary>Gets the order's team or club name; null when it has none.</summary>
    public string? Team { get; init; }

    /// <summary>Gets the order's customer name.</summary>
    public string? Customer { get; init; }

    /// <summary>Gets the payment method name of a payment.</summary>
    public string? PaymentMethod { get; init; }

    /// <summary>Gets the category name of a company or order expense.</summary>
    public string? Category { get; init; }

    /// <summary>Gets what a company or order expense was for.</summary>
    public string? Description { get; init; }

    /// <summary>Gets the other person on a transfer: the sender of a transfer in, the recipient of a transfer out.</summary>
    public ActorRef? Counterpart { get; init; }

    /// <summary>Gets the note of a transfer.</summary>
    public string? Note { get; init; }

    /// <summary>Gets the base64 row version of a transfer.</summary>
    public string? Version { get; init; }

    /// <summary>Gets a value indicating whether a transfer is a hand-over recorded by a Manager.</summary>
    public bool IsHandover { get; init; }

    /// <summary>Gets who recorded a transfer.</summary>
    public ActorRef? RecordedBy { get; init; }

    /// <summary>Gets who deleted a transfer.</summary>
    public ActorRef? DeletedBy { get; init; }

    /// <summary>Gets when a transfer was deleted.</summary>
    public DateTimeOffset? DeletedAtUtc { get; init; }
}
