using Csps.Application.Analytics;
using Csps.Domain.Content;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// A visitor's cookie decision (ANL-07). Anonymous and never cached. Each call is logged as one proof record and answered with the state the
/// server stored; the server also sets the consent cookie, so the browser keeps it for the full 12 months. The <c>Sec-GPC: 1</c> header
/// is read here and acted on by the handler (D-20).
/// </summary>
/// <param name="recordConsent">The decision handler.</param>
[ApiController]
[Route("api/v1/analytics/consent")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ConsentController(RecordConsentHandler recordConsent) : ControllerBase
{
    private const string GpcHeader = "Sec-GPC";
    private const string GpcOn = "1";
    private const string CurrentVersionKey = "currentVersion";

    /// <summary>Logs one decision and saves the choice cookie.</summary>
    /// <param name="body">The decision; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 200 with the stored state and the consent cookie, 400 for field errors, 403 without the anti-CSRF header, 409 with the current
    /// policy version when the decision was made under an old one, or 429 over the limit.
    /// </returns>
    [HttpPost]
    [EnableRateLimiting(RateLimitPolicies.Consent)]
    [IdempotencyExempt("Each consent decision is logged as its own proof record and the answer sets cookies; a repeat records the same choice again.")]
    [RequireCsrfHeader]
    [RequestSizeLimitMetadata(2048)]
    [EndpointName("RecordConsent")]
    [ProducesResponseType<ConsentDecisionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<IResult> RecordConsent(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] RecordConsentRequest? body,
        CancellationToken cancellationToken)
    {
        var gpc = string.Equals(Request.Headers[GpcHeader].ToString(), GpcOn, StringComparison.Ordinal);
        var context = new ConsentCallContext(gpc, HasVisitorId: false);
        var result = await recordConsent.HandleAsync(body ?? RecordConsentRequest.Empty, context, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure && result.Error.Code == ConsentErrors.PolicyChangedCode)
        {
            return PolicyChanged(result.Error.Message);
        }

        return result.ToHttpResult(HttpContext, outcome =>
        {
            AnalyticsCookies.SetConsent(Response, outcome.CookieValue, outcome.ExpiresAt);
            return TypedResults.Ok(outcome.Response);
        });
    }

    // The 409 also tells the browser which version is current, so it can ask the visitor again.
    private ProblemHttpResult PolicyChanged(string message)
    {
        var problem = CspsProblemDetails.Build(HttpContext, StatusCodes.Status409Conflict, message, code: ConsentErrors.PolicyChangedCode);
        problem.Extensions[CurrentVersionKey] = LegalPages.CookiePolicyVersion;
        return TypedResults.Problem(problem);
    }
}
