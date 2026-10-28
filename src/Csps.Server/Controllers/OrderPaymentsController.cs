using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The payments of a saved order (ORD-05, ORD-22): staff of either role record them, with the person who received the money, and
/// every answer is the whole order with its totals worked out again. A payment can never take the paid total above the order total
/// (D-11). Never cached.
/// </summary>
/// <param name="add">The add-a-payment handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/payments")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderPaymentsController(AddOrderPaymentHandler add) : ControllerBase
{
    /// <summary>
    /// Records a payment on a saved order with the order's version the form was opened with. The date is a real <c>yyyy-MM-dd</c>
    /// day, never after today in the shop's time zone. The amount is above 0.00 and at most 1,000,000.00 with at most two decimal
    /// places, and it may not be more than the balance: a payment above it answers 400 on <c>amount</c> with the most that can be
    /// entered. The payment method must exist and not be retired. <c>receivedByUserId</c> names who has the money and must be an
    /// active Admin or Manager; it is separate from who typed the payment in, which comes from the token. The reference holds up to
    /// 100 characters and the notes up to 500. A version that is not the stored one answers 409 <c>edit.stale</c> and changes
    /// nothing; a form save is never retried. The server works out the order's totals. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored answer and adds nothing more.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order already has 100 payments.</returns>
    [HttpPost]
    [EndpointName("AddOrderPayment")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderPaymentRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderPaymentRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
