using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: the Core Web Vitals of a visitor who allowed stats are stored against their current visit (ANL-05, D-26). It runs the same gates as the
/// page view: a bot or a missing User-Agent, signed-in staff, and the three identified gates (the visitor id, a consent cookie that passes
/// <c>ConsentCookie.AllowsStats</c> and no GPC). Every drop answers success, so a caller learns nothing from the answer. A report does not count
/// as a page view and does not move the visit's last-seen time. Rows stay when a visitor turns stats off (D-41).
/// </summary>
/// <param name="pages">Maps a cut path to a page key.</param>
/// <param name="visits">The visit store.</param>
/// <param name="calendar">The business clock: the day the samples belong to.</param>
/// <param name="validator">Checks the body.</param>
public sealed class CollectVitalsHandler(IPublicPageResolver pages, IAnalyticsVisits visits, IBusinessCalendar calendar, IValidator<VitalsRequest> validator)
{
    /// <summary>Stores the samples of one report, or drops it.</summary>
    /// <param name="request">The body as the browser sent it.</param>
    /// <param name="context">What the server read from the headers and cookies.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, whether or not anything was stored; a 400 naming the path for a bad body.</returns>
    public async Task<Result> HandleAsync(VitalsRequest request, CollectContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(context);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, PageViewErrors.ValidationCode, PageViewErrors.ValidationMessage));
        }

        if (AnalyticsBots.IsBot(context.UserAgent) || context.IsStaff)
        {
            return Result.Success();
        }

        if (AnalyticsPath.Cut(request.Path) is not { } cutPath || pages.PageKeyFor(cutPath) is not { } pageKey)
        {
            return Result.Success();
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        if (!IdentifiedCollection.IsAllowed(context, clock.Today))
        {
            return Result.Success();
        }

        var visitorHash = VisitorKey.HashVisitor(context.VisitorToken!);
        if (await visits.FindCurrentAsync(visitorHash, clock.UtcNow.AddMinutes(-AnalyticsRetention.SessionMinutes), cancellationToken).ConfigureAwait(false) is not { } visitId)
        {
            return Result.Success();
        }

        var samples = KeptSamples(request, visitId, clock.Today, pageKey);
        if (samples.Count > 0)
        {
            await visits.AddSamplesAsync(samples, cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }

    // Each metric the browser sent is checked on its own: one bad value drops only itself.
    private static List<AnalyticsVitalSample> KeptSamples(VitalsRequest request, Guid visitId, DateOnly day, string pageKey)
    {
        var samples = new List<AnalyticsVitalSample>(3);
        Keep(samples, visitId, day, pageKey, VitalMetric.Lcp, request.Lcp);
        Keep(samples, visitId, day, pageKey, VitalMetric.Cls, request.Cls);
        Keep(samples, visitId, day, pageKey, VitalMetric.Inp, request.Inp);
        return samples;
    }

    private static void Keep(List<AnalyticsVitalSample> samples, Guid visitId, DateOnly day, string pageKey, VitalMetric metric, decimal? value)
    {
        if (value is { } number && VitalBounds.IsValid(metric, number))
        {
            samples.Add(AnalyticsVitalSample.Of(visitId, day, metric, number, pageKey));
        }
    }
}
