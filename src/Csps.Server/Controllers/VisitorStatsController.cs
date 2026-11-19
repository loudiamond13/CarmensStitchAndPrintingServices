using System.Text;
using Csps.Application.Analytics;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Controllers;

/// <summary>The visitor stats read and CSV export (ANL-08, D-23): Managers only, so an Admin gets 403 and a caller with no valid token gets 401. Never cached.</summary>
/// <param name="stats">The visitor stats handler.</param>
/// <param name="export">The CSV export handler.</param>
[ApiController]
[Route("api/v1/visitor-stats")]
[Authorize(Policy = Policies.Manager)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class VisitorStatsController(GetVisitorStatsHandler stats, ExportVisitorStatsHandler export) : ControllerBase
{
    private const string CsvContentType = "text/csv";

    // Pitfall 3: a spreadsheet reads the file as UTF-8 only when it starts with a byte-order mark.
    private const string ByteOrderMark = "\uFEFF";

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

    /// <summary>
    /// Downloads the same range as a CSV file (D-69, D-75): UTF-8 with a byte-order mark, the header <c>Date,Page,Page views</c>, then one CRLF
    /// line per day and page that had views, with the page's name, ordered by date and then the fixed page order. A day or page with no views has
    /// no line, so a range with no views is the header alone. The file name is <c>visitor-stats-{from}-to-{to}.csv</c> with the dates the server used.
    /// </summary>
    /// <param name="range">The same range as the stats read.</param>
    /// <param name="from">The first business day, <c>YYYY-MM-DD</c>; required when the range is <c>custom</c>.</param>
    /// <param name="to">The last business day, <c>YYYY-MM-DD</c>; required when the range is <c>custom</c>.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the CSV file, 400 for a bad custom date, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet("export")]
    [EndpointName("ExportVisitorStats")]
    [ProducesResponseType<string>(StatusCodes.Status200OK, CsvContentType)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Export(
        [FromQuery] string? range,
        [FromQuery] string? from,
        [FromQuery] string? to,
        CancellationToken cancellationToken)
    {
        var result = await export.HandleAsync(new VisitorStatsRequest(range, from, to), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(
            HttpContext,
            file =>
            {
                // The name holds only the validated dates, so it needs no escaping (T-12-70).
                Response.Headers[HeaderNames.ContentDisposition] = $"attachment; filename=\"{file.FileName}\"";
                return TypedResults.Text(ByteOrderMark + file.Csv, CsvContentType, Encoding.UTF8);
            });
    }
}
