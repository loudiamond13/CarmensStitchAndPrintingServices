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

/// <summary>The wire keys of the six quote request statuses: lower case, one word.</summary>
public static class QuoteRequestStatusNames
{
    private static readonly (QuoteRequestStatus Status, string Key)[] Pairs =
    [
        (QuoteRequestStatus.New, "new"),
        (QuoteRequestStatus.Contacted, "contacted"),
        (QuoteRequestStatus.Quoted, "quoted"),
        (QuoteRequestStatus.Converted, "converted"),
        (QuoteRequestStatus.Closed, "closed"),
        (QuoteRequestStatus.Spam, "spam"),
    ];

    /// <summary>Gets the key of a status.</summary>
    /// <param name="status">The status.</param>
    /// <returns>For example <c>contacted</c> for <see cref="QuoteRequestStatus.Contacted"/>.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The number is not one of the six.</exception>
    public static string ToKey(QuoteRequestStatus status)
    {
        foreach (var (known, key) in Pairs)
        {
            if (known == status)
            {
                return key;
            }
        }

        throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown quote request status.");
    }

    /// <summary>Reads a key, ignoring case and spaces around it.</summary>
    /// <param name="text">The text sent by a client.</param>
    /// <param name="status">The status when the text is one of the six keys.</param>
    /// <returns>True when the text names a status.</returns>
    public static bool TryParse(string? text, out QuoteRequestStatus status)
    {
        foreach (var (known, key) in Pairs)
        {
            if (string.Equals(text?.Trim(), key, StringComparison.OrdinalIgnoreCase))
            {
                status = known;
                return true;
            }
        }

        status = default;
        return false;
    }
}
