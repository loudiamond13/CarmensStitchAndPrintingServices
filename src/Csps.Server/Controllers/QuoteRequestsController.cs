using Csps.Application.QuoteRequests;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The staff side of the quote requests (INQ-05, D-13): staff of either role read the inbox. The visitor's own sends are on the
/// public controller. Never cached.
/// </summary>
/// <param name="list">The inbox list handler.</param>
/// <param name="getNewCount">The shared New count handler.</param>
[ApiController]
[Route("api/v1/quote-requests")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class QuoteRequestsController(ListQuoteRequestsHandler list, GetNewQuoteCountHandler getNewCount) : ControllerBase
{
    /// <summary>
    /// Lists quote requests for both roles, newest received first with the id breaking ties. By default it keeps the open requests:
    /// New, Contacted and Quoted. The answer also carries the count behind each filter pill, over the whole table, which the search
    /// and the page do not change. The email and the message are not in the list.
    /// </summary>
    /// <param name="status"><c>open</c> (the default), <c>converted</c>, <c>closed</c>, <c>spam</c> or <c>all</c>.</param>
    /// <param name="q">Search text for the name, the team or the digits of the phone number; up to 100 characters.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="size">Rows per page: 10, 20, 50 or 100; 20 when not sent.</param>
    /// <returns>200 with the page, 400 for a bad status, search, page or size, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListQuoteRequests")]
    [ProducesResponseType<QuoteRequestListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(
        [FromQuery] string? status,
        [FromQuery] string? q,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int size = ListQuoteRequestsRequest.DefaultSize)
    {
        var result = await list.HandleAsync(new ListQuoteRequestsRequest(status, q, page, size), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }

    /// <summary>
    /// Counts the requests at status New, for the badge on the menu. It is one number for every staff member of either role: nothing is
    /// kept per person.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with <c>{ "count": n }</c>, or 401 without a valid token.</returns>
    [HttpGet("new-count")]
    [EndpointName("GetNewQuoteCount")]
    [ProducesResponseType<NewQuoteCountResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> GetNewCount(CancellationToken cancellationToken)
    {
        var result = await getNewCount.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static count => TypedResults.Ok(count));
    }
}
