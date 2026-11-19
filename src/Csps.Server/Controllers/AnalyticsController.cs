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
/// The page view beacon (ANL-05, ANL-06). Anonymous and never cached. The controller only reads headers and cookies into a
/// <see cref="CollectContext"/>; the handler decides what is counted. No value read here is logged or stored by the anonymous count.
/// </summary>
/// <param name="collectPageView">The page view handler.</param>
/// <param name="links">The site's public address, whose host tells an own-site referrer from an outside one.</param>
[ApiController]
[Route("api/v1/analytics")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AnalyticsController(CollectPageViewHandler collectPageView, IOptions<AppLinksOptions> links) : ControllerBase
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

    private CollectContext ReadContext() => new(
        Request.Headers.UserAgent.ToString() is { Length: > 0 } userAgent ? userAgent : null,
        Request.Cookies.ContainsKey(AnalyticsCookies.StaffCookieName) || Request.Headers.ContainsKey(HeaderNames.Authorization),
        string.Equals(Request.Headers[GpcHeader].ToString(), GpcOn, StringComparison.Ordinal),
        Request.Cookies[AnalyticsCookies.VisitorCookieName] is { } visitor && AnalyticsCookies.IsVisitorId(visitor) ? visitor : null,
        Request.Cookies[AnalyticsCookies.ConsentCookieName],
        Uri.TryCreate(links.Value.PublicBaseUrl, UriKind.Absolute, out var site) ? site.Host : null);
}
