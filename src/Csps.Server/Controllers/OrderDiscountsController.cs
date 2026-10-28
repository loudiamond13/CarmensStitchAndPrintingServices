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
[ApiController]
[Route("api/v1/orders/{orderId:guid}/discounts")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderDiscountsController(AddOrderDiscountHandler add) : ControllerBase
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
    /// <returns>200 with the whole order, 400 for field errors, 401 without a valid token, 404 when the order does not exist or was deleted, or 409 for a stale version.</returns>
    [HttpPost]
    [EndpointName("AddOrderDiscount")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Add(
        Guid orderId,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] AddOrderDiscountRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await add.HandleAsync(orderId, body ?? AddOrderDiscountRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
