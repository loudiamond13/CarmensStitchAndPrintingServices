using Csps.Application.Analytics;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>The visitor stats read (ANL-08, D-23): Managers only, so an Admin gets 403 and a caller with no valid token gets 401. Never cached.</summary>
/// <param name="stats">The visitor stats handler.</param>
[ApiController]
[Route("api/v1/visitor-stats")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class VisitorStatsController(GetVisitorStatsHandler stats) : ControllerBase
{
    /// <summary>
    /// Reads unique visitors, visits and page views for a date range. The server resolves the range in the business zone (Asia/Manila) and
    /// returns the dates it used. Page views are kept for 3 years; visits and unique visitors for 13 months, so a range that starts earlier
    /// counts them from the cut date, and a range wholly before it answers them as null.
    /// </summary>
    /// <param name="range">A preset: <c>last-7-days</c>, <c>last-30-days</c> (also used when none or an unknown name is sent), <c>this-month</c>, <c>last-month</c>, <c>this-year</c>; or <c>custom</c>.</param>
    /// <param name="from">The first business day, <c>YYYY-MM-DD</c>; required when the range is <c>custom</c>.</param>
    /// <param name="to">The last business day, <c>YYYY-MM-DD</c>; required when the range is <c>custom</c>.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the totals, 400 for a bad custom date, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet]
    [EndpointName("GetVisitorStats")]
    [ProducesResponseType<VisitorStatsResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Get(
        [FromQuery] string? range,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken cancellationToken)
    {
        var result = await stats.HandleAsync(new VisitorStatsRequest(range, from, to), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static answer => TypedResults.Ok(answer));
    }
}
