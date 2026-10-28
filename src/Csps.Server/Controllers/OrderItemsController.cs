using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The items of a saved order (ORD-05, ORD-13): staff of either role add them, correct them and remove them, and every answer is
/// the whole order with its totals worked out again. Never cached.
/// </summary>
/// <param name="add">The add-an-item handler.</param>
/// <param name="update">The edit-an-item handler.</param>
/// <param name="remove">The remove-an-item handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/items")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderItemsController(AddOrderItemHandler add, UpdateOrderItemHandler update, RemoveOrderItemHandler remove) : ControllerBase
{
    /// <summary>
    /// Adds an item to a saved order with the order's version the form was opened with. The item rules are the same as when creating
    /// an order: a product type that exists and is not retired, a description of up to 200 characters, an optional size or variant
    /// of up to 100, a quantity from 1 to 10,000 and a unit price from 0.00 to 1,000,000.00 with two decimal places. An order has at
    /// most 100 items. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form save is never
    /// retried. The server works out the line total and the order's totals. Who added the item and when come from the token and the
    /// clock; any such member in the body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the stored
    /// answer and adds nothing more.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order already has 100 items.</returns>
    [HttpPost]
    [EndpointName("AddOrderItem")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderItemRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderItemRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Saves an edit of one item of a saved order with the order's version the form was opened with. The item rules are the same as
    /// when adding. The product type is checked against the list only when the edit changes it, so an item may keep a type that was
    /// retired after it was saved. An item id that is not on this order answers 404 <c>orders.item-not-found</c>. A version that is
    /// not the stored one answers 409 <c>edit.stale</c> and changes nothing; a form save is never retried. An edit that changes
    /// nothing saves nothing and keeps the version. An edit that would leave the discounts more than the new items total answers 422
    /// <c>orders.discount-above-subtotal</c> and changes nothing. Who changed the item and when come from the token and the clock.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="itemId">The item id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the item on it does not exist, 409 for a stale version, or 422 when the discounts would be more than the new items total.</returns>
    [HttpPut("{itemId:guid}")]
    [EndpointName("UpdateOrderItem")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Update(
        Guid orderId,
        Guid itemId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOrderItemRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(orderId, itemId, body ?? UpdateOrderItemRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Removes one item of a saved order. No version is sent: the removal applies to the latest state, and a lost race is read again
    /// and decided again once. An order keeps at least one item, so removing the last one answers 422 <c>orders.last-item</c>. An item
    /// id that is not on this order answers 404 <c>orders.item-not-found</c>. A removal that would leave the discounts more than the
    /// new items total answers 422 <c>orders.discount-above-subtotal</c>. The totals are worked out again.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="itemId">The item id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 401 without a valid token, 404 when the order or the item on it does not exist, 409 when two saves lost a race twice, or 422 when it is the last item or the discounts would be more than the new items total.</returns>
    [HttpDelete("{itemId:guid}")]
    [EndpointName("RemoveOrderItem")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Remove(Guid orderId, Guid itemId, CancellationToken cancellationToken)
    {
        var result = await remove.HandleAsync(orderId, itemId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
