namespace Csps.Domain.Analytics;

/// <summary>One page view inside a visit (ANL-05): the page key and the time. It holds no path, query or address.</summary>
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

    /// <summary>Makes one page view.</summary>
    /// <param name="visitId">The visit.</param>
    /// <param name="businessDay">The business day of the view.</param>
    /// <param name="occurredAtUtc">The server time.</param>
    /// <param name="pageKey">The page key.</param>
    /// <returns>The new, unsaved row.</returns>
    /// <exception cref="ArgumentException">The visit id is empty, or the page key is blank or longer than <see cref="PageKeys.MaxLength"/>.</exception>
    public static AnalyticsPageView Of(Guid visitId, DateOnly businessDay, DateTimeOffset occurredAtUtc, string pageKey)
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

        return new AnalyticsPageView { VisitId = visitId, BusinessDay = businessDay, OccurredAtUtc = occurredAtUtc, PageKey = pageKey };
    }
}
