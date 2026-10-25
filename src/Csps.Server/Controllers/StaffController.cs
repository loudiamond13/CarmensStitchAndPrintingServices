using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The staff who can be named as the payer (CEXP-05, D-32): either role reads the list. It returns ids and names only, never an
/// email address, a role or an account state, because the full roster stays Manager-only. Never cached.
/// </summary>
/// <param name="list">The list handler.</param>
[ApiController]
[Route("api/v1/staff")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class StaffController(ListStaffHandler list) : ControllerBase
{
    /// <summary>
    /// Lists the people who can be named as the payer: an Admin or Manager who is active, not locked by a Manager, not deleted
    /// and has a password. An invited person who has not set a password is not listed. Sorted by first name, last name, then id.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the people, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListStaff")]
    [ProducesResponseType<IReadOnlyList<StaffMember>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static people => TypedResults.Ok(people));
    }
}
