using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the site settings (D-29, CONT-01): staff read them, and only Managers save the business info.</summary>
/// <param name="handler">The read handler.</param>
/// <param name="update">The save handler (Managers only).</param>
/// <param name="quoteAlertTest">The Quote alerts test email handler (Managers only).</param>
[ApiController]
[Route("api/v1/site-settings")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SiteSettingsController(
    GetSiteSettingsHandler handler, UpdateSiteSettingsHandler update, SendQuoteAlertTestHandler quoteAlertTest) : ControllerBase
{
    /// <summary>
    /// Returns every Business Info field, the shop email (staff only), the phones with the main one first, the version a save must
    /// send back, who last changed the settings and when, and the fixed time zone, currency and locale.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The settings, or the failure as ProblemDetails.</returns>
    [HttpGet]
    [EndpointName("GetSiteSettings")]
    [ProducesResponseType<SiteSettingsDto>(StatusCodes.Status200OK)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static dto => TypedResults.Ok(dto));
    }

    /// <summary>
    /// Saves the business info, Managers only: the name, tagline, about text, turnaround line, address parts, directions and map links,
    /// one to four phone numbers with exactly one main, the Messenger, Facebook, Instagram and TikTok links and the shop email. An empty
    /// optional value is stored as not set and left out of the public site. The time zone, currency and locale are not part of the
    /// save. The next public read and page show the change. A <c>version</c> that is not the stored one answers 409 <c>edit.stale</c>
    /// and changes nothing; a form save is never retried. A save with no change stores nothing, writes no audit entry and keeps the
    /// version. Who changed it and when come from the token and the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved settings, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 for a stale version.</returns>
    [HttpPut]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("UpdateSiteSettings")]
    [ProducesResponseType<SiteSettingsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Put(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateSiteSettingsRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(body ?? UpdateSiteSettingsRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Sends a test email to the saved Quote alerts address, Managers only (D-11). It goes to the saved address, never to one in the
    /// request, and is recorded in the audit log as <c>quote-alerts.test-sent</c> with no address. No saved address answers 409
    /// <c>site-settings.no-quote-alerts-address</c> and sends nothing; an address that can never receive mail answers 422
    /// <c>site-settings.quote-alerts-address-undeliverable</c>. One address may send 3 tests in 10 minutes (<c>RateLimits:QuoteAlertTest</c>);
    /// the next answers 429 with <c>Retry-After</c>. Needs an <c>Idempotency-Key</c>.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>202 when the email is queued, 401 without a valid token, 403 for an Admin, 409 with no saved address, 422, or 429.</returns>
    [HttpPost("quote-alerts/test")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("SendQuoteAlertTest")]
    [EnableRateLimiting(RateLimitPolicies.QuoteAlertTest)]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> SendQuoteAlertTest(CancellationToken cancellationToken)
    {
        var result = await quoteAlertTest.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.Accepted((string?)null));
    }
}
