namespace Csps.Domain.QuoteRequests;

/// <summary>
/// The six statuses of a quote request (D-15). The numbers are stored data, so they are fixed and never renumbered or reused.
/// There is no value 0.
/// </summary>
public enum QuoteRequestStatus : byte
{
    /// <summary>Just arrived; counted by the inbox badge.</summary>
    New = 1,

    /// <summary>Staff have been in touch.</summary>
    Contacted = 2,

    /// <summary>A price was sent.</summary>
    Quoted = 3,

    /// <summary>Turned into an order; set only by the conversion.</summary>
    Converted = 4,

    /// <summary>Finished with no order.</summary>
    Closed = 5,

    /// <summary>Not a real request.</summary>
    Spam = 6,
}
