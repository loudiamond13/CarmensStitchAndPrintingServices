namespace Csps.Domain.QuoteRequests;

/// <summary>How long a quote request that never became an order is kept (INQ-07, Phase 12 D-02, D-07).</summary>
public static class QuoteRequestRetention
{
    /// <summary>Calendar months a request is kept.</summary>
    public const int Months = 0;

    /// <summary>Requests received before this instant are purged (RED scaffold).</summary>
    /// <param name="today">Today's business date.</param>
    /// <param name="zone">The business zone.</param>
    /// <returns>The cut as a UTC instant.</returns>
    public static DateTimeOffset PurgeBefore(DateOnly today, TimeZoneInfo zone) => default;
}
