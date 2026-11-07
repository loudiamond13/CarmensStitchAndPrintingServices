using Csps.Application.Dashboard;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The admin dashboard (DASH-01): staff of either role read the same live shop figures. Never cached (D-13).
/// </summary>
/// <param name="summary">The dashboard summary handler.</param>
[ApiController]
[Route("api/v1/dashboard")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DashboardController(GetDashboardSummaryHandler summary) : ControllerBase
{
    /// <summary>
    /// Reads the dashboard summary: the business today, the part of the day for the greeting (<c>morning</c>, <c>afternoon</c> or
    /// <c>evening</c>), the signed-in person's first name and the order figures. Both roles get the same figures; only the first name
    /// and the greeting can differ. Nothing is cached, so every visit shows live numbers.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the summary, or 401 without a valid token.</returns>
    [HttpGet("summary")]
    [EndpointName("GetDashboardSummary")]
    [ProducesResponseType<DashboardSummaryResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> GetSummary(CancellationToken cancellationToken)
    {
        var result = await summary.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static figures => TypedResults.Ok(figures));
    }
}
