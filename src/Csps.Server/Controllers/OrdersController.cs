using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The shop's orders (ORD-03): staff of either role create and read them. Never cached.
/// </summary>
/// <param name="create">The create-an-order handler.</param>
/// <param name="get">The single-order read handler.</param>
[ApiController]
[Route("api/v1/orders")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrdersController(CreateOrderHandler create, GetOrderHandler get) : ControllerBase
{
    /// <summary>
    /// Creates an order with its items in one call. The customer name, a contact number (digits, spaces and + - ( ) only), the order
    /// date and the due date are required, and the due date may not be before the order date. The status may be pending, mockup,
    /// production, ready or delivered and is pending when not sent; Completed and Cancelled are refused on a new order. An order
    /// has 1 to 100 items, each with a product type that exists and is not retired, a description of up to 200 characters, an
    /// optional size or variant, a quantity from 1 to 10,000 and a unit price from 0.00 to 1,000,000.00 with two decimal places.
    /// The order number, <c>ORD-{YYYY}-{NNNN}</c>, takes its year from the business year of the save, and the money figures
    /// are worked out by the server. Who recorded the order and when come from the token and the clock; any such member, a number
    /// or totals in the body are ignored. The first status history row is written with the order. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored 201 and creates nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the order and its location, 400 for field errors, 401 without a valid token, or 409 <c>orders.busy</c> when another order is being numbered and the wait timed out.</returns>
    [HttpPost]
    [EndpointName("CreateOrder")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] CreateOrderRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(body ?? CreateOrderRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/orders/{created.Id:D}", created));
    }

    /// <summary>
    /// Reads one order with its items, status history, money figures, who recorded it and who last changed it. Both roles read
    /// every order. A deleted order is the same 404 as an unknown one.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the order, 401 without a valid token, or 404 when it does not exist or was deleted.</returns>
    [HttpGet("{id:guid}")]
    [EndpointName("GetOrder")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }
}
