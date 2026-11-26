namespace Csps.Domain.QuoteRequests;

/// <summary>
/// One row of a quote request's status history (D-15): from which status to which, who moved it and when. The arrival itself is not a
/// row: it is the request's received time, with no creator (SEC-08).
/// </summary>
public sealed class QuoteRequestStatusChange
{
    // Used by EF Core (constructor binding), by QuoteRequest.ChangeStatus and by QuoteRequest.MarkConverted.
    internal QuoteRequestStatusChange(
        Guid id,
        Guid quoteRequestId,
        QuoteRequestStatus fromStatus,
        QuoteRequestStatus toStatus,
        Guid? changedById,
        DateTimeOffset changedAtUtc,
        Guid? orderId = null)
    {
        Id = id;
        QuoteRequestId = quoteRequestId;
        FromStatus = fromStatus;
        ToStatus = toStatus;
        ChangedById = changedById;
        ChangedAtUtc = changedAtUtc;
        OrderId = orderId;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the request the row belongs to.</summary>
    public Guid QuoteRequestId { get; private set; }

    /// <summary>Gets the status the request left.</summary>
    public QuoteRequestStatus FromStatus { get; private set; }

    /// <summary>Gets the status the request entered.</summary>
    public QuoteRequestStatus ToStatus { get; private set; }

    /// <summary>Gets who moved the request; null reads as System.</summary>
    public Guid? ChangedById { get; private set; }

    /// <summary>Gets when the request moved, in UTC.</summary>
    public DateTimeOffset ChangedAtUtc { get; private set; }

    /// <summary>Gets the order the request became; set only on the conversion row.</summary>
    public Guid? OrderId { get; private set; }
}
