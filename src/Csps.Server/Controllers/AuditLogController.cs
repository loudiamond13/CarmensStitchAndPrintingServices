using Csps.Application.Audit;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The audit log viewer (AUDIT-02, D-26): Managers only, so an Admin gets 403 and a caller with no valid token gets 401. The log is read
/// only and there is no export (D-29). Never cached.
/// </summary>
/// <param name="list">The audit list handler.</param>
/// <param name="people">The handler that lists the people the filters offer.</param>
[ApiController]
[Route("api/v1/audit-log")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditLogController(ListAuditLogHandler list, ListAuditPeopleHandler people) : ControllerBase
{
    /// <summary>
    /// Lists audit entries, newest first (by time, then by id). With no dates the range is today and the 6 business days before it; a date
    /// is a business day (<c>YYYY-MM-DD</c>, Manila time) from the start of the kept window (8 months) to today, and the range includes the
    /// whole of both days. An actor also matches a person's own sign-in, code, reset and invitation steps. The detail holds the stored
    /// fixed words only: field names and role values, never a name or an email address (D-40).
    /// </summary>
    /// <param name="from">The first business day, <c>YYYY-MM-DD</c>; none means 6 days before today.</param>
    /// <param name="to">The last business day, <c>YYYY-MM-DD</c>; none means today.</param>
    /// <param name="actor">A user id, or <c>system</c>, to keep only what that person (or nobody) did.</param>
    /// <param name="action">An action code, for example <c>user.deactivated</c>.</param>
    /// <param name="target">A user id, to keep only entries about that person, including their session events.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Entries per page, from 1 to 100; 20 when not sent.</param>
    /// <returns>200 with the page, 400 for a bad filter, date or page, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListAuditLog")]
    [ProducesResponseType<AuditLogResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? actor,
        [FromQuery] string? action,
        [FromQuery] string? target,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListAuditLogRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListAuditLogRequest(from, to, actor, action, target, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static entries => TypedResults.Ok(entries));
    }

    /// <summary>
    /// Lists everyone the Done by and Done to filters can offer: every person ever recorded as staff, active or inactive by name first,
    /// then former staff by name. Names only, never an email address.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the people, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet("people")]
    [EndpointName("ListAuditPeople")]
    [ProducesResponseType<IReadOnlyList<AuditPerson>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> ListPeople(CancellationToken cancellationToken)
    {
        var result = await people.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static found => TypedResults.Ok(found));
    }
}
