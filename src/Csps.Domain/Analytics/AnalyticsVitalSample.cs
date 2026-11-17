namespace Csps.Domain.Analytics;

/// <summary>One Core Web Vitals measurement of a visit (ANL-05, D-26): which metric, the value and the page it was measured on.</summary>
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

    /// <summary>Gets the metric.</summary>
    public VitalMetric Metric { get; private set; }

    /// <summary>Gets the value: milliseconds for LCP and INP, a score for CLS.</summary>
    public decimal Value { get; private set; }

    /// <summary>Gets the page key the sample was measured on.</summary>
    public string PageKey { get; private set; }

    /// <summary>Makes one sample.</summary>
    /// <param name="visitId">The visit.</param>
    /// <param name="businessDay">The business day.</param>
    /// <param name="metric">The metric.</param>
    /// <param name="value">The value; rounded to three decimals.</param>
    /// <param name="pageKey">The page key.</param>
    /// <returns>The new, unsaved row.</returns>
    /// <exception cref="ArgumentException">The visit id is empty, or the page key is blank or too long.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The metric is unknown or the value is outside <see cref="VitalBounds"/>.</exception>
    public static AnalyticsVitalSample Of(Guid visitId, DateOnly businessDay, VitalMetric metric, decimal value, string pageKey)
    {
        if (visitId == Guid.Empty)
        {
            throw new ArgumentException("The visit id is empty.", nameof(visitId));
        }

        ArgumentException.ThrowIfNullOrWhiteSpace(pageKey);
        if (pageKey.Length > PageKeys.MaxLength)
        {
            throw new ArgumentException("The page key is longer than the column holds.", nameof(pageKey));
        }

        if (!Enum.IsDefined(metric))
        {
            throw new ArgumentOutOfRangeException(nameof(metric), metric, "Unknown metric.");
        }

        if (!VitalBounds.IsValid(metric, value))
        {
            throw new ArgumentOutOfRangeException(nameof(value), value, "The value is outside the accepted range.");
        }

        return new AnalyticsVitalSample
        {
            VisitId = visitId,
            BusinessDay = businessDay,
            Metric = metric,
            Value = Math.Round(value, Scale, MidpointRounding.AwayFromZero),
            PageKey = pageKey,
        };
    }
}
