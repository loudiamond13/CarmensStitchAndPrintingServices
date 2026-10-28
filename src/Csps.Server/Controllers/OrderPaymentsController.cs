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
/// <param name="update">The edit-a-payment handler.</param>
/// <param name="remove">The remove-a-payment handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/payments")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderPaymentsController(AddOrderPaymentHandler add, UpdateOrderPaymentHandler update, RemoveOrderPaymentHandler remove) : ControllerBase
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

    /// <summary>
    /// Saves an edit of one payment of a saved order with the order's version the form was opened with. The rules are the same as
    /// when adding. An edit may lower the amount freely and may raise it only up to the balance plus the amount it had (400 on
    /// <c>amount</c>). The payment method and the receiver are checked only when the edit changes them, so a payment may keep a
    /// method that was retired or a receiver who was deactivated after it was saved. A payment id that is not on this order answers
    /// 404 <c>orders.payment-not-found</c>. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing;
    /// a form save is never retried. An edit that changes nothing saves nothing and keeps the version. Who changed the payment and
    /// when come from the token and the clock.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="paymentId">The payment id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the payment on it does not exist, or 409 for a stale version.</returns>
    [HttpPut("{paymentId:guid}")]
    [EndpointName("UpdateOrderPayment")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid orderId,
        Guid paymentId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOrderPaymentRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(orderId, paymentId, body ?? UpdateOrderPaymentRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Removes one payment of a saved order. No version is sent: the removal applies to the latest state, and a lost race is read
    /// again and decided again once. A payment id that is not on this order answers 404 <c>orders.payment-not-found</c>. The totals
    /// are worked out again; if the order was fully paid it now has a balance again.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="paymentId">The payment id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 401 without a valid token, 404 when the order or the payment on it does not exist, or 409 when two saves lost a race twice.</returns>
    [HttpDelete("{paymentId:guid}")]
    [EndpointName("RemoveOrderPayment")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Remove(Guid orderId, Guid paymentId, CancellationToken cancellationToken)
    {
        var result = await remove.HandleAsync(orderId, paymentId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
