namespace Csps.Domain.Analytics;

/// <summary>One page view inside a visit (ANL-05): the page key and the time. Kept only so the retention job can age out old rows (D-80).</summary>
public sealed class AnalyticsPageView
{
    private AnalyticsPageView()
    {
        PageKey = string.Empty;
    }

    /// <summary>Gets the row id, made by the database.</summary>
    public long Id { get; private set; }

    /// <summary>Gets the visit the view belongs to.</summary>
    public Guid VisitId { get; private set; }

    /// <summary>Gets the business day of the view.</summary>
    public DateOnly BusinessDay { get; private set; }

    /// <summary>Gets the server time of the view.</summary>
    public DateTimeOffset OccurredAtUtc { get; private set; }

    /// <summary>Gets the page key, one of <see cref="PageKeys"/>.</summary>
    public string PageKey { get; private set; }
}
