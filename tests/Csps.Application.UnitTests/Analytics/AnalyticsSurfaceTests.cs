using Csps.Application.Analytics;

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
}
