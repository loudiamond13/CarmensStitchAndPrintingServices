using Csps.Application.Analytics;
using Csps.Infrastructure.Email;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Controllers;

/// <summary>
/// The visitor stats beacons (ANL-05, ANL-06). Anonymous and never cached. The controller only reads headers and cookies into a
/// <see cref="CollectContext"/>; the handler decides what is counted. No value read here is logged or stored by the anonymous count.
/// </summary>
/// <param name="clearVisitorData">The clear handler.</param>
/// <param name="collectPageView">The page view handler.</param>
/// <param name="collectVitals">The page speed handler.</param>
/// <param name="links">The site's public address, whose host tells an own-site referrer from an outside one.</param>
[ApiController]
[Route("api/v1/analytics")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AnalyticsController(ClearVisitorDataHandler clearVisitorData, CollectPageViewHandler collectPageView, CollectVitalsHandler collectVitals, IOptions<AppLinksOptions> links) : ControllerBase
{
    private const string GpcHeader = "Sec-GPC";
    private const string GpcOn = "1";

    /// <summary>Counts one public page view for the business day, anonymously.</summary>
    /// <param name="body">The page path and the referrer host; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 for a well-formed body, whether or not the view was counted; 400 for a missing or malformed path; 403 without the anti-CSRF header; 429 over the limit.</returns>
    [HttpPost("page-views")]
    [EnableRateLimiting(RateLimitPolicies.AnalyticsCollect)]
    [IdempotencyExempt("An analytics beacon: a repeat only adds one page view, and beacons are exempt by SEC-06.")]
    [RequireCsrfHeader]
    [RequestSizeLimitMetadata(2048)]
    [EndpointName("RecordPageView")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> RecordPageView(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] PageViewRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await collectPageView.HandleAsync(body ?? PageViewRequest.Empty, ReadContext(), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, () => TypedResults.NoContent());
    }

    /// <summary>Stores a consented visitor's Core Web Vitals against their current visit.</summary>
    /// <param name="body">The page path and the measured metrics; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 for a well-formed body, whether or not anything was stored; 400 for a missing or malformed path; 403 without the anti-CSRF header; 429 over the limit.</returns>
    [HttpPost("vitals")]
    [EnableRateLimiting(RateLimitPolicies.AnalyticsCollect)]
    [IdempotencyExempt("An analytics beacon: a repeat only adds one more speed sample, and beacons are exempt by SEC-06.")]
    [RequireCsrfHeader]
    [RequestSizeLimitMetadata(2048)]
    [EndpointName("RecordVitals")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> RecordVitals(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] VitalsRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await collectVitals.HandleAsync(body ?? VitalsRequest.Empty, ReadContext(), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes the analytics rows tied to this browser's visitor id, expires that cookie and records a reset decision (stats off, map off).
    /// The visitor is chosen only by the HttpOnly cookie: the call has no id in its address or body (CWE-639), and the answer is the same
    /// whether or not a cookie was sent or anything was deleted.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the stored state and the consent cookie; 403 without the anti-CSRF header; 429 over the limit.</returns>
    [HttpPost("clear")]
    [EnableRateLimiting(RateLimitPolicies.AnalyticsClear)]
    [IdempotencyExempt("Deletes this browser's visit records and sets cookies; a repeat finds nothing more to delete.")]
    [RequireCsrfHeader]
    [RequestSizeLimitMetadata(2048)]
    [EndpointName("ClearVisitorData")]
    [ProducesResponseType<ConsentDecisionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> ClearVisitorData(CancellationToken cancellationToken)
    {
        var token = Request.Cookies[AnalyticsCookies.VisitorCookieName] is { } held && AnalyticsCookies.IsVisitorId(held) ? held : null;
        var context = new ClearCallContext(string.Equals(Request.Headers[GpcHeader].ToString(), GpcOn, StringComparison.Ordinal), token);
        var result = await clearVisitorData.HandleAsync(context, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, outcome =>
        {
            AnalyticsCookies.SetConsent(Response, outcome.CookieValue, outcome.ExpiresAt);
            AnalyticsCookies.ExpireVisitor(Response);
            return TypedResults.Ok(outcome.Response);
        });
    }

    private CollectContext ReadContext() => new(
        Request.Headers.UserAgent.ToString() is { Length: > 0 } userAgent ? userAgent : null,
        Request.Cookies.ContainsKey(AnalyticsCookies.StaffCookieName) || Request.Headers.ContainsKey(HeaderNames.Authorization),
        string.Equals(Request.Headers[GpcHeader].ToString(), GpcOn, StringComparison.Ordinal),
        Request.Cookies[AnalyticsCookies.VisitorCookieName] is { } visitor && AnalyticsCookies.IsVisitorId(visitor) ? visitor : null,
        Request.Cookies[AnalyticsCookies.ConsentCookieName],
        Uri.TryCreate(links.Value.PublicBaseUrl, UriKind.Absolute, out var site) ? site.Host : null);
}
