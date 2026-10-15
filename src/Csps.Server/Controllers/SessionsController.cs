using Csps.Application.Auth;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in devices of the caller (D-43): list them. Each user sees and manages only their own sessions.
/// Never cached.
/// </summary>
/// <param name="list">The list handler.</param>
[ApiController]
[Route("api/v1/sessions")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class SessionsController(ListSessionsHandler list) : ControllerBase
{
    /// <summary>Lists the caller's own active sessions: this device first, then the rest by recent activity, at most 100.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the sessions, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListSessions")]
    [ProducesResponseType<IReadOnlyList<SessionListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }
}
