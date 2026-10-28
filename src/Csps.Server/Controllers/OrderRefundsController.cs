using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The refunds of a saved order (ORD-18, D-07): staff of either role record money handed back to the customer, with the person who
/// handed it back, on a cancelled order or one with a customer credit, and every answer is the whole order with its totals worked
/// out again. A refund is the one change a cancelled order accepts without a reopen. Never cached.
/// </summary>
/// <param name="add">The add-a-refund handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/refunds")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderRefundsController(AddOrderRefundHandler add) : ControllerBase
{
    /// <summary>
    /// Records a refund on a saved order with the order's version the form was opened with. The date is a real <c>yyyy-MM-dd</c>
    /// day, never after today in the shop's time zone. The amount is above 0.00 and at most 1,000,000.00 with at most two decimal
    /// places. The reason is 1 to 200 characters. <c>refundedByUserId</c> names who handed the money back and must be an active
    /// Admin or Manager; it is separate from who typed the refund in, which comes from the token. A refund is allowed only on a
    /// cancelled order or one with a customer credit; on an order that is not cancelled it may not pass the credit, and on a
    /// cancelled order it may not pass what was paid and not yet refunded. A version that is not the stored one answers 409
    /// <c>edit.stale</c> and changes nothing; a form save is never retried. A retry with the same <c>Idempotency-Key</c> and body
    /// answers with the stored answer and adds nothing more.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order is completed, cannot be refunded or already has 50 refunds.</returns>
    [HttpPost]
    [EndpointName("AddOrderRefund")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderRefundRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderRefundRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
