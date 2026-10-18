using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The staff roster (USER-01): Managers only (USER-08). An Admin gets 403 and a caller with no valid token gets 401.
/// Deleted people are never listed or read (D-09). Never cached.
/// </summary>
/// <param name="list">The roster list handler.</param>
/// <param name="get">The single-person read handler.</param>
[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class UsersController(ListUsersHandler list, GetUserHandler get) : ControllerBase
{
    /// <summary>
    /// Lists staff, sorted by first name, then last name, then id. A page past the last returns no rows and the true total.
    /// </summary>
    /// <param name="q">Search text for the name or email; blank means no search.</param>
    /// <param name="role"><c>admin</c> or <c>manager</c>; none means both.</param>
    /// <param name="status"><c>active</c>, <c>inactive</c> or <c>locked</c>; none means all.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the page, 400 for a bad filter or page, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListUsers")]
    [ProducesResponseType<UserListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? role,
        [FromQuery] string? status,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListUsersRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListUsersRequest(q, role, status, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static roster => TypedResults.Ok(roster));
    }

    /// <summary>Reads one person with their edit version and who created and last changed them (SEC-08).</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the person, 401 without a valid token, 403 for an Admin, or 404 when the person does not exist or was deleted.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetUser")]
    [ProducesResponseType<UserDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static person => TypedResults.Ok(person));
    }
}
