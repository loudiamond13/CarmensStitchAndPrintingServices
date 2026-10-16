using Csps.Application.Auth;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in devices of the caller (D-43): list them and sign one of the others out. Each user sees and manages
/// only their own sessions.
/// Never cached.
/// </summary>
/// <param name="list">The list handler.</param>
/// <param name="revoke">The per-device sign-out handler.</param>
[ApiController]
[Route("api/v1/sessions")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SessionsController(ListSessionsHandler list, RevokeSessionHandler revoke) : ControllerBase
{
    /// <summary>Lists the caller's own active sessions: this device first, then the rest by recent activity, at most 100.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the sessions, or 401 without a valid token.</returns>
    [HttpGet]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    [EndpointName("ListSessions")]
    [ProducesResponseType<IReadOnlyList<SessionListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>Signs out one of the caller's other devices. Repeating the call is a success.</summary>
    /// <param name="id">The session to sign out.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>
    /// 200 with whether it had already ended, 404 when it is not one of the caller's sessions, 422 for the current
    /// session, 401 without a valid token, or 409 when two saves lost a race.
    /// </returns>
    [HttpDelete("{id:guid}")]
    [EnableRateLimiting(RateLimitPolicies.Refresh)]
    [EndpointName("RevokeSession")]
    [ProducesResponseType<RevokeSessionResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Revoke(Guid id, CancellationToken cancellationToken)
    {
        var result = await revoke.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }
}
