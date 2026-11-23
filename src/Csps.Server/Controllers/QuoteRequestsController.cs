using Csps.Application.QuoteRequests;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The staff side of the quote requests (INQ-05, D-13): staff of either role read the inbox, open a request and change its status.
/// The visitor's own sends are on the public controller. Never cached.
/// </summary>
/// <param name="list">The inbox list handler.</param>
/// <param name="getNewCount">The shared New count handler.</param>
/// <param name="get">The one-request read handler.</param>
/// <param name="changeStatus">The change-status handler.</param>
[ApiController]
[Route("api/v1/quote-requests")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class QuoteRequestsController(
    ListQuoteRequestsHandler list,
    GetNewQuoteCountHandler getNewCount,
    GetQuoteRequestHandler get,
    ChangeQuoteRequestStatusHandler changeStatus) : ControllerBase
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

    /// <summary>
    /// Reads one quote request in full for both roles: every field, the photos that arrived with their private addresses (thumb, viewer
    /// and the 2000 px "Open Full Size"), the names of the photos that never arrived, when the photos were removed for Spam, the status
    /// history newest first ending with the arrival, who last changed it, and the row version a status change must send back.
    /// </summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the request, 401 without a valid token, or 404 when there is no such request.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetQuoteRequest")]
    [ProducesResponseType<QuoteRequestDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static request => TypedResults.Ok(request));
    }

    /// <summary>
    /// Moves a quote request to another status, for both roles. The body is <c>{ "status": "...", "version": "..." }</c> with one of new,
    /// contacted, quoted, closed or spam, and the row version the page was opened with. Moves among those five are free in any
    /// direction. Converted is set only by turning the request into an order: it is refused as a target (400
    /// <c>quote-requests.validation</c>), and a Converted request cannot change status by hand (400
    /// <c>quote-requests.converted-locked</c>). A move to the status the request already has is a 400. Every move is recorded in the
    /// history with who made it and when, and in the audit log with the two statuses only. Leaving New takes the request off the New
    /// count for everyone. Moving to Spam queues every stored photo for removal and removes the photo places in the same save; the
    /// daily maintenance run deletes the files, and moving back out of Spam does not restore them. Any other member in the body is
    /// ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored answer. The answer holds only the id, the
    /// new status, when it changed and the new row version, so no visitor details are stored with it; read the request again for the
    /// history.
    /// </summary>
    /// <param name="id">The request id.</param>
    /// <param name="body">The new status and the version; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the new status and version, 400 on the status or version, 401 without a valid token, 404 when there is no such request, or 409 when the version is out of date.</returns>
    [HttpPost("{id:guid}/status")]
    [EndpointName("ChangeQuoteRequestStatus")]
    [ProducesResponseType<QuoteRequestStatusChangedResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> ChangeStatus(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ChangeQuoteRequestStatusRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await changeStatus.HandleAsync(id, body ?? ChangeQuoteRequestStatusRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static changed => TypedResults.Ok(changed));
    }
}
