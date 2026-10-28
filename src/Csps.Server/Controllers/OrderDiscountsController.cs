using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The discounts of a saved order (D-15, ORD-05): staff of either role add them, correct them and remove them, and every answer is
/// the whole order with its totals worked out again. Never cached.
/// </summary>
/// <param name="add">The add-a-discount handler.</param>
/// <param name="update">The edit-a-discount handler.</param>
/// <param name="remove">The remove-a-discount handler.</param>
[ApiController]
[Route("api/v1/orders/{orderId:guid}/discounts")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderDiscountsController(AddOrderDiscountHandler add, UpdateOrderDiscountHandler update, RemoveOrderDiscountHandler remove) : ControllerBase
{
    /// <summary>
    /// Adds a discount to a saved order with the order's version the form was opened with. The kind is <c>fixed</c> (a value from
    /// 0.01 to 1,000,000.00) or <c>percentage</c> (a value above 0 and up to 100), each with at most two decimal places, and the
    /// reason is 1 to 100 characters. A version that is not the stored one answers 409 <c>edit.stale</c> and changes nothing; a
    /// form save is never retried. The server works out the order's totals. Who added the discount and when come from the token and
    /// the clock; any such member in the body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the
    /// stored answer and adds nothing more.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, 409 for a stale version, or 422 when the order already has 20 discounts.</returns>
    [HttpPost]
    [EndpointName("AddOrderDiscount")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderDiscountRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderDiscountRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Saves an edit of one discount of a saved order with the order's version the form was opened with. The rules are the same as
    /// when adding, and the discounts together may not be more than the items total (400 on <c>value</c>). A discount id that is not
    /// on this order answers 404 <c>orders.discount-not-found</c>. A version that is not the stored one answers 409
    /// <c>edit.stale</c> and changes nothing; a form save is never retried. An edit that changes nothing saves nothing and keeps
    /// the version. Who changed the discount and when come from the token and the clock.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="discountId">The discount id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order or the discount on it does not exist, or 409 for a stale version.</returns>
    [HttpPut("{discountId:guid}")]
    [EndpointName("UpdateOrderDiscount")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid orderId,
        Guid discountId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOrderDiscountRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(orderId, discountId, body ?? UpdateOrderDiscountRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Removes one discount of a saved order. No version is sent: the removal applies to the latest state, and a lost race is read
    /// again and decided again once. A discount id that is not on this order answers 404 <c>orders.discount-not-found</c>. The
    /// totals are worked out again.
    /// </summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="discountId">The discount id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 401 without a valid token, 404 when the order or the discount on it does not exist, or 409 when two saves lost a race twice.</returns>
    [HttpDelete("{discountId:guid}")]
    [EndpointName("RemoveOrderDiscount")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Remove(Guid orderId, Guid discountId, CancellationToken cancellationToken)
    {
        var result = await remove.HandleAsync(orderId, discountId, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
