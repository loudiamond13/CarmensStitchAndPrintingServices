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
[ApiController]
[Route("api/v1/quote-requests")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class QuoteRequestsController(ListQuoteRequestsHandler list) : ControllerBase
{
    /// <summary>
    /// Lists the quote requests that are still open: New, Contacted and Quoted, newest received first. Both roles read every request.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the page, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListQuoteRequests")]
    [ProducesResponseType<QuoteRequestListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static page => TypedResults.Ok(page));
    }
}
