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
[ApiController]
[Route("api/v1/orders/{orderId:guid}/items")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderItemsController(AddOrderItemHandler add) : ControllerBase
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
}
