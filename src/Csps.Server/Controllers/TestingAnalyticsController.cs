#if CSPS_TESTING
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Infrastructure.Analytics;
using Csps.Infrastructure.Content;
using Csps.Server.Http;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Lets E2E specs put visitor stats on chosen business days (ANL-08, D-27), so the 13-month view is proved with exact numbers. It
/// exists in the Testing environment of a Debug build only. The controller holds no database types: the seeder in Infrastructure
/// does the work.
/// </summary>
/// <param name="seeder">Replaces the analytics rows on the given days.</param>
/// <param name="calendar">The business calendar, for today and the visit times.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/analytics")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingAnalyticsController(TestingAnalyticsSeeder seeder, IBusinessCalendar calendar) : ControllerBase
{
    private const int MaxDays = 60;

    private const int MaxVisitsPerDay = 50;

    private const int MaxPageViewsPerVisit = 20;

    private const int MaxViews = 100_000;

    private const string Invalid = "The analytics seed needs 1 to 60 days, each a past or current business day within 3 years, a known page key, at least one view, and visits with a source, a device class, browser and OS labels and 1 to 20 page views. Each day and page appears once.";

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly HashSet<string> KnownPages = new(
        [PageKeys.Home, PageKeys.Products, PageKeys.Gallery, PageKeys.Contact, PageKeys.Privacy, PageKeys.Cookies, PageKeys.Terms, PageKeys.Accessibility, PageKeys.NotFound],
        StringComparer.Ordinal);

    /// <summary>The body of the seed call.</summary>
    /// <param name="Days">The days to put in place.</param>
    public sealed record TestingAnalyticsRequest(IReadOnlyList<TestingAnalyticsDayRequest>? Days = null);

    /// <summary>One page on one day.</summary>
    /// <param name="OffsetDays">Days from the business today: 0 is today, -1 yesterday.</param>
    /// <param name="PageKey">The page key, such as <c>home</c>.</param>
    /// <param name="Views">The page views of the page on the day.</param>
    /// <param name="Visits">The visits that landed on the page; none when left out.</param>
    public sealed record TestingAnalyticsDayRequest(int? OffsetDays = null, string? PageKey = null, int? Views = null, IReadOnlyList<TestingAnalyticsVisitRequest>? Visits = null);

    /// <summary>One visit.</summary>
    /// <param name="Referrer">The source name, such as <c>Facebook</c> or <c>Direct</c>.</param>
    /// <param name="Device">Phone, Tablet, Computer or Other.</param>
    /// <param name="Browser">The browser family label.</param>
    /// <param name="Os">The OS family label.</param>
    /// <param name="PageViews">How many pages the visit saw.</param>
    public sealed record TestingAnalyticsVisitRequest(string? Referrer = null, string? Device = null, string? Browser = null, string? Os = null, int? PageViews = null);

    /// <summary>Replaces the analytics rows on the given days with the given figures.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 when the rows are in place; 400 for a missing or out-of-bounds body; 403 when the host is connected to a database other than the end-to-end or per-test ones.</returns>
    [HttpPost]
    [IdempotencyExempt("Testing-only test data, compiled out of Release.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Seed(CancellationToken cancellationToken)
    {
        if (!seeder.IsDatabaseAllowed)
        {
            return TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status403Forbidden, TestingDatabaseGuard.Refusal));
        }

        // Read here, not bound, so a missing or malformed body is the same plain 400 for every caller.
        TestingAnalyticsRequest? request;
        try
        {
            request = await JsonSerializer.DeserializeAsync<TestingAnalyticsRequest>(Request.Body, JsonOptions, cancellationToken).ConfigureAwait(false);
        }
        catch (JsonException)
        {
            request = null;
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var days = Parse(request, clock.Today);
        if (days is null)
        {
            return TypedResults.Problem(CspsProblemDetails.Build(HttpContext, StatusCodes.Status400BadRequest, Invalid));
        }

        await seeder.SeedAsync(days, clock, cancellationToken).ConfigureAwait(false);
        return TypedResults.NoContent();
    }

    // The checked figures, or null when anything is missing or out of bounds.
    private static List<TestingAnalyticsDay>? Parse(TestingAnalyticsRequest? request, DateOnly today)
    {
        if (request?.Days is not { Count: > 0 and <= MaxDays } days)
        {
            return null;
        }

        var floor = AnalyticsRetention.DailyFloor(today);
        var parsed = new List<TestingAnalyticsDay>();
        foreach (var day in days)
        {
            if (day is not { OffsetDays: <= 0 and var offset, PageKey: { } pageKey, Views: > 0 and <= MaxViews and var views }
                || today.AddDays(offset) < floor
                || !KnownPages.Contains(pageKey)
                || day.Visits is { Count: > MaxVisitsPerDay })
            {
                return null;
            }

            var date = today.AddDays(offset);
            if (parsed.Exists(seen => seen.Day == date && seen.PageKey == pageKey))
            {
                return null;
            }

            var visits = new List<TestingAnalyticsVisit>();
            foreach (var visit in day.Visits ?? [])
            {
                if (ParseVisit(visit) is not { } checkedVisit)
                {
                    return null;
                }

                visits.Add(checkedVisit);
            }

            parsed.Add(new TestingAnalyticsDay(date, pageKey, views, visits));
        }

        return parsed;
    }

    private static TestingAnalyticsVisit? ParseVisit(TestingAnalyticsVisitRequest? visit)
    {
        if (visit is not { Referrer: { } referrer, Device: { } device, Browser: { } browser, Os: { } os, PageViews: > 0 and <= MaxPageViewsPerVisit and var pageViews }
            || string.IsNullOrWhiteSpace(referrer)
            || referrer.Length > ReferrerName.MaxLength
            || !IsLabel(browser)
            || !IsLabel(os)
            || !Enum.GetNames<DeviceKind>().Contains(device, StringComparer.Ordinal))
        {
            return null;
        }

        return new TestingAnalyticsVisit(referrer, Enum.Parse<DeviceKind>(device), browser, os, pageViews);
    }

    private static bool IsLabel(string label) => !string.IsNullOrWhiteSpace(label) && label.Length <= AnalyticsVisit.LabelMaxLength;
}
#endif
