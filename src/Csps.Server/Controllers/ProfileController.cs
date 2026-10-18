using Csps.Application.Profile;
using Csps.Application.Security;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The signed-in staff member's own profile (PROF-01): read it and change the name. There is no user id in the route;
/// every call acts on the token's user only (CWE-639). Never cached.
/// </summary>
/// <param name="get">The read handler.</param>
/// <param name="update">The name-save handler.</param>
[ApiController]
[Route("api/v1/profile")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProfileController(GetProfileHandler get, UpdateProfileNameHandler update) : ControllerBase
{
    /// <summary>Reads the caller's profile, including the edit version the next save must send.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the profile, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("GetProfile")]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static profile => TypedResults.Ok(profile));
    }

    /// <summary>Changes the caller's first and last name. The version must be the one the form was opened with.</summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the profile, 400 for field errors, 401 without a valid token, or 409 when the form is out of date.</returns>
    [HttpPut]
    [EndpointName("UpdateProfileName")]
    [ProducesResponseType<ProfileResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateProfileNameRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(body ?? UpdateProfileNameRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static profile => TypedResults.Ok(profile));
    }
}
