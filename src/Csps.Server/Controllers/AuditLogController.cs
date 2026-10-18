using Csps.Application.Audit;
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
[ApiController]
[Route("api/v1/audit-log")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class AuditLogController(ListAuditLogHandler list) : ControllerBase
{
    /// <summary>
    /// Lists audit entries, newest first (by time, then by id). With no dates the range is today and the 6 business days before it. The
    /// detail holds the stored fixed words only: field names and role values, never a name or an email address (D-40).
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1.</param>
    /// <param name="pageSize">Entries per page, from 1 to 100; 20 when not sent.</param>
    /// <returns>200 with the page, 400 for a bad page, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("ListAuditLog")]
    [ProducesResponseType<AuditLogResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> List(
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListAuditLogRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListAuditLogRequest(page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static entries => TypedResults.Ok(entries));
    }
}
