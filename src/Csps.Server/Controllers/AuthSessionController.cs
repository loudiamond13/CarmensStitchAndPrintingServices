using Csps.Application.Auth;
using Csps.Application.Security;
using Csps.Domain.Common;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in session after sign-in: renew it with the refresh cookie (AUTH-05), sign out this device, or sign
/// out every other device (AUTH-06). Never cached; the cookie-reading actions need the anti-CSRF header.
/// </summary>
/// <param name="refresh">The refresh handler.</param>
/// <param name="signOut">The sign-out handler.</param>
/// <param name="signOutOthers">The sign-out-other-devices handler.</param>
[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthSessionController(RefreshHandler refresh, SignOutHandler signOut, SignOutOthersHandler signOutOthers) : ControllerBase
{
    /// <summary>Renews the access token with the refresh cookie and rotates the cookie.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 200 with the session and the rotated cookie, 401 when the session ended (the cookie is deleted), 409 when two
    /// refreshes raced and this one lost (the cookie stays), or 403 without the anti-CSRF header.
    /// </returns>
    [HttpPost("refresh")]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    [IdempotencyExempt("Returns a new access token and rotates the cookie; must never be stored or replayed.")]
    [AllowAnonymous]
    [RequireCsrfHeader]
    [EndpointName("Refresh")]
    [ProducesResponseType<SessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Refresh(CancellationToken cancellationToken)
    {
        var token = Request.Cookies[AuthCookies.RefreshCookieName];
        var result = await refresh.HandleAsync(token, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure && result.Error.Kind == ErrorKind.Unauthenticated)
        {
            AuthCookies.ClearRefresh(Response);
        }

        return result.ToHttpResult(HttpContext, outcome =>
        {
            AuthCookies.SetRefresh(Response, outcome.RefreshToken, outcome.CookieExpiresAt);
            return TypedResults.Ok(outcome.Response);
        });
    }

    /// <summary>Ends this device's session and clears the refresh cookie. It succeeds with no cookie too.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 and a deleted cookie, 403 without the anti-CSRF header, or 409 when two saves lost a race.</returns>
    [HttpPost("sign-out")]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    [IdempotencyExempt("Naturally idempotent: a repeat finds nothing more to revoke; it clears the refresh cookie.")]
    [AllowAnonymous]
    [RequireCsrfHeader]
    [EndpointName("SignOut")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> SignOut(CancellationToken cancellationToken)
    {
        var token = Request.Cookies[AuthCookies.RefreshCookieName];
        var result = await signOut.HandleAsync(token, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, () =>
        {
            AuthCookies.ClearRefresh(Response);
            return TypedResults.NoContent();
        });
    }

    /// <summary>Ends every other session of the signed-in user and keeps this one. It succeeds when there is nothing to end.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, or 409 when two saves lost a race.</returns>
    [HttpPost("sign-out-others")]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    [IdempotencyExempt("Naturally idempotent: a repeat finds nothing more to revoke; no answer worth storing.")]
    [Authorize(Policy = Policies.Staff)]
    [EndpointName("SignOutOthers")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> SignOutOthers(CancellationToken cancellationToken)
    {
        var result = await signOutOthers.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}
