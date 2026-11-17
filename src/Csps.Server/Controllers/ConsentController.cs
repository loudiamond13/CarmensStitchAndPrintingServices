using Csps.Application.Analytics;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// A visitor's cookie decision (ANL-07). Anonymous and never cached. Each call is logged as one proof record and answered with the state the
/// server stored; the server also sets the consent cookie, so the browser keeps it for the full 12 months.
/// </summary>
/// <param name="recordConsent">The decision handler.</param>
[ApiController]
[Route("api/v1/analytics/consent")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ConsentController(RecordConsentHandler recordConsent) : ControllerBase
{
    /// <summary>Logs one decision and saves the choice cookie.</summary>
    /// <param name="body">The decision; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the stored state and the consent cookie, 400 for field errors, 403 without the anti-CSRF header, or 429 over the limit.</returns>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Consent)]
    [IdempotencyExempt("Each consent decision is logged as its own proof record and the answer sets cookies; a repeat records the same choice again.")]
    [RequireCsrfHeader]
    [RequestSizeLimitMetadata(2048)]
    [EndpointName("RecordConsent")]
    [ProducesResponseType<ConsentDecisionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> RecordConsent(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RecordConsentRequest? body,
        CancellationToken cancellationToken)
    {
        var context = new ConsentCallContext(Gpc: false, HasVisitorId: false);
        var result = await recordConsent.HandleAsync(body ?? RecordConsentRequest.Empty, context, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, outcome =>
        {
            AnalyticsCookies.SetConsent(Response, outcome.CookieValue, outcome.ExpiresAt);
            return TypedResults.Ok(outcome.Response);
        });
    }
}
