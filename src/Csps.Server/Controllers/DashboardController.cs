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
/// <param name="chart">The dashboard chart handler.</param>
[ApiController]
[Route("api/v1/dashboard")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class DashboardController(GetDashboardSummaryHandler summary, GetDashboardChartHandler chart) : ControllerBase
{
    /// <summary>
    /// Reads the dashboard summary: the business today (<c>today</c>), the part of the day for the greeting (<c>greeting</c>:
    /// <c>morning</c>, <c>afternoon</c> or <c>evening</c>), the signed-in person's first name (<c>firstName</c>), the order figures
    /// (<c>orders</c>: active, due this week, overdue and receivables), the money collected this month with last month's comparison
    /// and the change in percent (<c>collected</c>), this month's company expenses with their count and top category
    /// (<c>expenses</c>), the six statuses of the orders-by-status bar (<c>statuses</c>) and the six newest orders
    /// (<c>recentOrders</c>). Every figure uses the same business date and instant. Both roles get the same figures; only the first
    /// name and the greeting can differ. Nothing is cached, so every visit shows live numbers.
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

    /// <summary>
    /// Reads the money-over-time chart: one entry for every month of the window, oldest first, the current business month last. Each
    /// month has <c>income</c> (payments minus refunds, so it can be below zero), <c>expenses</c> (company plus order expenses) and
    /// <c>profit</c> (income minus expenses). A month with no money is listed with 0.00. Money on Cancelled orders counts; money on
    /// deleted orders and deleted company expenses does not. Both roles get the same answer. Nothing is cached.
    /// </summary>
    /// <param name="months">How many months to show: 6 or 12; 6 when not sent. Anything else is a 400 on <c>months</c>.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the chart, 400 for a window other than 6 or 12, or 401 without a valid token.</returns>
    [HttpGet("chart")]
    [EndpointName("GetDashboardChart")]
    [ProducesResponseType<DashboardChartResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> GetChart([FromQuery] string? months, CancellationToken cancellationToken)
    {
        var result = await chart.HandleAsync(new GetDashboardChartRequest(months), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static figures => TypedResults.Ok(figures));
    }
}
