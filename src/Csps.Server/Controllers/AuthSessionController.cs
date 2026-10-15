using Csps.Application.Auth;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in session after sign-in: renew it with the refresh cookie (AUTH-05). Never cached; the cookie-reading
/// actions need the anti-CSRF header.
/// </summary>
/// <param name="refresh">The refresh handler.</param>
[ApiController]
[Route("api/v1/auth")]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuthSessionController(RefreshHandler refresh) : ControllerBase
{
    /// <summary>Renews the access token with the refresh cookie and rotates the cookie.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 200 with the session and the rotated cookie, 401 when the session ended (the cookie is deleted), or 403
    /// without the anti-CSRF header.
    /// </returns>
    [HttpPost("refresh")]
    [AllowAnonymous]
    [RequireCsrfHeader]
    [EndpointName("Refresh")]
    [ProducesResponseType<SessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Refresh(CancellationToken cancellationToken)
    {
        var token = Request.Cookies[AuthCookies.RefreshCookieName];
        var result = await refresh.HandleAsync(token, cancellationToken).ConfigureAwait(false);
        if (result.IsFailure)
        {
            AuthCookies.ClearRefresh(Response);
        }

        return result.ToHttpResult(HttpContext, outcome =>
        {
            AuthCookies.SetRefresh(Response, outcome.RefreshToken, outcome.CookieExpiresAt);
            return TypedResults.Ok(outcome.Response);
        });
    }
}
