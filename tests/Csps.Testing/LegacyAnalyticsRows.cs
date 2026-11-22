using Csps.Domain.Analytics;

namespace Csps.Testing;

/// <summary>
/// Builds rows for the analytics tables that nothing writes any more (D-80), so retention and reader tests can seed old data. The entities
/// have no public factory, so each row is made by setting its stored values directly.
/// </summary>
public static class LegacyAnalyticsRows
{
    /// <summary>Makes a visit row.</summary>
    /// <param name="visitorHash">The 32-byte visitor hash.</param>
    /// <param name="day">The business day of the visit.</param>
    /// <param name="startedAtUtc">When the visit started.</param>
    /// <param name="referrer">The source name.</param>
    /// <param name="device">The device class number.</param>
    /// <param name="browser">The browser label.</param>
    /// <returns>The new, unsaved visit.</returns>
    public static AnalyticsVisit Visit(byte[] visitorHash, DateOnly day, DateTimeOffset startedAtUtc, string referrer, byte device, string browser) =>
        Make<AnalyticsVisit>(
            (nameof(AnalyticsVisit.Id), Guid.CreateVersion7(startedAtUtc)),
            (nameof(AnalyticsVisit.VisitorHash), visitorHash),
            (nameof(AnalyticsVisit.BusinessDay), day),
            (nameof(AnalyticsVisit.StartedAtUtc), startedAtUtc),
            (nameof(AnalyticsVisit.LastSeenAtUtc), startedAtUtc),
            (nameof(AnalyticsVisit.Referrer), referrer),
            (nameof(AnalyticsVisit.Device), device),
            (nameof(AnalyticsVisit.Browser), browser),
            (nameof(AnalyticsVisit.Os), "Windows"),
            (nameof(AnalyticsVisit.PageViews), 1));

    /// <summary>Makes a page view row.</summary>
    /// <param name="visitId">The visit.</param>
    /// <param name="day">The business day.</param>
    /// <param name="occurredAtUtc">The time of the view.</param>
    /// <param name="pageKey">The page key.</param>
    /// <returns>The new, unsaved row.</returns>
    public static AnalyticsPageView PageView(Guid visitId, DateOnly day, DateTimeOffset occurredAtUtc, string pageKey) =>
        Make<AnalyticsPageView>(
            (nameof(AnalyticsPageView.VisitId), visitId),
            (nameof(AnalyticsPageView.BusinessDay), day),
            (nameof(AnalyticsPageView.OccurredAtUtc), occurredAtUtc),
            (nameof(AnalyticsPageView.PageKey), pageKey));

    /// <summary>Makes a Core Web Vitals sample row.</summary>
    /// <param name="visitId">The visit.</param>
    /// <param name="day">The business day.</param>
    /// <param name="metric">The metric number.</param>
    /// <param name="value">The value.</param>
    /// <param name="pageKey">The page key.</param>
    /// <returns>The new, unsaved row.</returns>
    public static AnalyticsVitalSample VitalSample(Guid visitId, DateOnly day, byte metric, decimal value, string pageKey) =>
        Make<AnalyticsVitalSample>(
            (nameof(AnalyticsVitalSample.VisitId), visitId),
            (nameof(AnalyticsVitalSample.BusinessDay), day),
            (nameof(AnalyticsVitalSample.Metric), metric),
            (nameof(AnalyticsVitalSample.Value), value),
            (nameof(AnalyticsVitalSample.PageKey), pageKey));

    /// <summary>Makes a consent record row.</summary>
    /// <param name="decidedAtUtc">The time of the decision.</param>
    /// <returns>The new, unsaved row.</returns>
    public static ConsentRecord Consent(DateTimeOffset decidedAtUtc) =>
        Make<ConsentRecord>(
            (nameof(ConsentRecord.Id), Guid.CreateVersion7(decidedAtUtc)),
            (nameof(ConsentRecord.ConsentId), Guid.NewGuid()),
            (nameof(ConsentRecord.PolicyVersion), "1.0"),
            (nameof(ConsentRecord.Stats), true),
            (nameof(ConsentRecord.Source), (byte)1),
            (nameof(ConsentRecord.DecidedAtUtc), decidedAtUtc));

    /// <summary>Makes a daily source count row.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="referrer">The source name.</param>
    /// <param name="visits">The visit count.</param>
    /// <returns>The new, unsaved row.</returns>
    public static DailyReferrerCount ReferrerCount(DateOnly day, string referrer, int visits) =>
        Make<DailyReferrerCount>(
            (nameof(DailyReferrerCount.BusinessDay), day),
            (nameof(DailyReferrerCount.Referrer), referrer),
            (nameof(DailyReferrerCount.Visits), visits));

    /// <summary>Makes a daily device or browser count row.</summary>
    /// <param name="day">The business day.</param>
    /// <param name="dimension">1 for a device class, 2 for a browser.</param>
    /// <param name="name">The label.</param>
    /// <param name="visits">The visit count.</param>
    /// <returns>The new, unsaved row.</returns>
    public static DailyDeviceCount DeviceCount(DateOnly day, byte dimension, string name, int visits) =>
        Make<DailyDeviceCount>(
            (nameof(DailyDeviceCount.BusinessDay), day),
            (nameof(DailyDeviceCount.Dimension), dimension),
            (nameof(DailyDeviceCount.Name), name),
            (nameof(DailyDeviceCount.Visits), visits));

    /// <summary>Makes an address salt row.</summary>
    /// <param name="day">The business day.</param>
    /// <returns>The new, unsaved row with a random 32-byte salt.</returns>
    public static AnalyticsSalt Salt(DateOnly day) =>
        Make<AnalyticsSalt>(
            (nameof(AnalyticsSalt.BusinessDay), day),
            (nameof(AnalyticsSalt.Salt), System.Security.Cryptography.RandomNumberGenerator.GetBytes(AnalyticsSalt.Length)));

    private static T Make<T>(params (string Name, object Value)[] values)
        where T : class
    {
        var row = (T)Activator.CreateInstance(typeof(T), nonPublic: true)!;
        foreach (var (name, value) in values)
        {
            typeof(T).GetProperty(name)!.SetValue(row, value);
        }

        return row;
    }
}
