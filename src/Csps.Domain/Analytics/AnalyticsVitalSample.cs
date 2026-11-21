namespace Csps.Domain.Analytics;

/// <summary>One Core Web Vitals measurement of a visit (ANL-05, D-26). Kept only so the retention job can age out old rows (D-80).</summary>
public sealed class AnalyticsVitalSample
{
    /// <summary>The number of decimal places the table keeps.</summary>
    public const int Scale = 3;

    private AnalyticsVitalSample()
    {
        PageKey = string.Empty;
    }

    /// <summary>Gets the row id, made by the database.</summary>
    public long Id { get; private set; }

    /// <summary>Gets the visit the sample belongs to.</summary>
    public Guid VisitId { get; private set; }

    /// <summary>Gets the business day of the sample.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets the metric number (1 LCP, 2 CLS, 3 INP).</summary>
    public byte Metric { get; private set; }

    /// <summary>Gets the value: milliseconds for LCP and INP, a score for CLS.</summary>
    public decimal Value { get; private set; }

    /// <summary>Gets the page key the sample was measured on.</summary>
    public string PageKey { get; private set; }
}
