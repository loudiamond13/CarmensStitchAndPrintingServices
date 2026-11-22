namespace Csps.Domain.QuoteRequests;

/// <summary>A visitor's quote request. Compile surface only; the behavior arrives with the first implementation commit.</summary>
public sealed class QuoteRequest
{
    /// <summary>Gets the id.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the visitor's name.</summary>
    public string CustomerName { get; private set; } = string.Empty;

    /// <summary>Gets the mobile number as E.164.</summary>
    public string ContactNumberE164 { get; private set; } = string.Empty;

    /// <summary>Gets the status.</summary>
    public QuoteRequestStatus Status { get; private set; }

    /// <summary>Gets who created the record; null for an anonymous visitor.</summary>
    public Guid? CreatedById { get; private set; }

    /// <summary>Gets when the record was created, in UTC.</summary>
    public DateTimeOffset CreatedAtUtc { get; private set; }
}
