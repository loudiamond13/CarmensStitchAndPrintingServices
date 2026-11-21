using Csps.Application.Analytics;
using Csps.Domain.Analytics;

namespace Csps.Application.UnitTests.Analytics;

// Guards D-59: the code for the removed consent, clear and speed sample routes must not come back.
public sealed class AnalyticsSurfaceTests
{
    private static readonly string[] RemovedTypes =
    [
        "RecordConsentHandler",
        "RecordConsentRequest",
        "RecordConsentRequestValidator",
        "ConsentCallContext",
        "ConsentDecisionResponse",
        "ConsentErrors",
        "ConsentOutcome",
        "ConsentSources",
        "VisitorIdAction",
        "ClearVisitorDataHandler",
        "ClearCallContext",
        "CollectVitalsHandler",
        "VitalsRequest",
        "VitalsRequestValidator",
    ];

    [Fact]
    public void HasNoConsentClearOrSpeedSampleType()
    {
        var present = typeof(CollectPageViewHandler).Assembly.GetTypes()
            .Select(type => type.Name)
            .Intersect(RemovedTypes, StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        present.ShouldBeEmpty();
    }

    private static readonly string[] VisitorIdentityTypes =
    [
        "IdentifiedCollection",
        "VisitorKey",
        "IAnalyticsVisits",
        "IAnalyticsSalts",
        "IConsentRecords",
    ];

    [Fact]
    public void HasNoVisitorIdentityType()
    {
        var present = typeof(CollectPageViewHandler).Assembly.GetTypes()
            .Select(type => type.Name)
            .Intersect(VisitorIdentityTypes, StringComparer.Ordinal)
            .Order(StringComparer.Ordinal)
            .ToList();

        present.ShouldBeEmpty();
    }

    [Fact]
    public void HasNoConsentCookieOrDeviceHelper()
    {
        var domain = typeof(DailyPageCount).Assembly;
        var names = domain.GetTypes().Select(type => type.Name).ToList();

        names.Intersect(["ConsentCookie", "DeviceClass", "OsFamily", "DeviceKind", "DeviceDimension", "ConsentSource"], StringComparer.Ordinal).ShouldBeEmpty();
        var retention = domain.GetType("Csps.Domain.Analytics.AnalyticsRetention").ShouldNotBeNull();
        retention.GetMember("SessionMinutes").ShouldBeEmpty();
        retention.GetMember("ConsentLifetimeMonths").ShouldBeEmpty();
    }

    [Fact]
    public void HasNoSpeedRatingHelper()
    {
        var names = typeof(DailyPageCount).Assembly.GetTypes().Select(type => type.Name).ToList();

        names.Intersect(["VitalRating", "VitalGrade", "NearestRank", "VitalBounds", "VitalMetric"], StringComparer.Ordinal).Order(StringComparer.Ordinal).ShouldBeEmpty();
    }
}
