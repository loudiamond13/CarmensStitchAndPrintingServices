using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>
/// The shop's orders (ORD-03, ORD-05, ORD-17): staff of either role create, read, edit and move them between statuses. Never cached.
/// </summary>
/// <param name="create">The create-an-order handler.</param>
/// <param name="list">The order list handler.</param>
/// <param name="get">The single-order read handler.</param>
/// <param name="updateDetails">The edit-details handler.</param>
/// <param name="changeStatus">The change-status handler.</param>
/// <param name="delete">The soft-delete handler (both roles).</param>
/// <param name="listDeleted">The deleted-order list handler (Managers only).</param>
/// <param name="restore">The restore handler (Managers only).</param>
/// <param name="permanentlyDelete">The permanent-delete handler (Managers only).</param>
[ApiController]
[Route("api/v1/orders")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrdersController(CreateOrderHandler create, ListOrdersHandler list, GetOrderHandler get, UpdateOrderDetailsHandler updateDetails, ChangeOrderStatusHandler changeStatus, DeleteOrderHandler delete, ListDeletedOrdersHandler listDeleted, RestoreOrderHandler restore, PermanentlyDeleteOrderHandler permanentlyDelete) : ControllerBase
{
    /// <summary>
    /// Lists orders for both roles, with the stored money figures, never any contact details. By default it keeps the orders in play:
    /// Pending to Delivered, plus Completed and Cancelled orders whose status changed in the last 30 days, soonest due first with
    /// orders that have no due date last. Deleted orders never appear and never count. The total covers every page of the filter.
    /// </summary>
    /// <param name="q">Search text for the order number, customer name, team or contact number; up to 100 characters.</param>
    /// <param name="status"><c>active</c> (the default), <c>all</c>, or one of pending, mockup, production, ready, delivered, completed or cancelled.</param>
    /// <param name="from">The first order date as <c>yyyy-MM-dd</c>.</param>
    /// <param name="to">The last order date as <c>yyyy-MM-dd</c>; not before <c>from</c>.</param>
    /// <param name="productType">A product type id; keeps orders with at least one item of that type.</param>
    /// <param name="hasBalance">True keeps only orders whose balance is above 0.00.</param>
    /// <param name="sort"><c>due</c> (the default), <c>newest</c>, <c>balance</c> or <c>total</c>; the order id breaks every tie.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <returns>200 with the page, 400 for a bad filter, sort or page, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListOrders")]
    [ProducesResponseType<OrderListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] string? from,
        [FromQuery] string? to,
        [FromQuery] string? productType,
        [FromQuery] bool? hasBalance,
        [FromQuery] string? sort,
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListOrdersRequest.DefaultPageSize)
    {
        var result = await list.HandleAsync(new ListOrdersRequest(q, status, from, to, productType, hasBalance, sort, page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static orders => TypedResults.Ok(orders));
    }

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

    /// <summary>
    /// Saves an edit of one order's customer details, dates and notes with the version the form was opened with. The field rules are
    /// the same as when creating, and the due date is required even for an imported order that had none. A version that is not the
    /// stored one answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. Any staff member may edit any
    /// order. Items, status, number and money figures are not changed here. Who changed it and when come from the token and the
    /// clock; any such member in the body is ignored. A form with no change saves nothing and keeps the version.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved order, 400 for field errors, 401 without a valid token, 404 when it does not exist or was deleted, or 409 for a stale version.</returns>
    [HttpPut("{id:guid}")]
    [EndpointName("UpdateOrderDetails")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> UpdateDetails(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] UpdateOrderDetailsRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await updateDetails.HandleAsync(id, body ?? UpdateOrderDetailsRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Moves an order to another status. The body is <c>{ "status": "..." }</c> with one of pending, mockup, production, ready,
    /// delivered, completed or cancelled. Moves among pending, mockup, production, ready and delivered are free, and cancelling is
    /// allowed from any of them. Completed needs a balance of exactly 0.00: money owed answers 422
    /// <c>orders.complete-balance-owed</c> and a customer credit 422 <c>orders.complete-credit</c>. A Completed or Cancelled order
    /// is reopened by moving it to any of the five active statuses, by an Admin or a Manager; going straight from Completed to
    /// Cancelled or back answers 422 <c>orders.reopen-first</c>. No version is sent: the move is judged on the latest state. Every
    /// move and reopen is recorded in the status history with who made it and when. A request for the status the order already has
    /// answers 200 and changes nothing. Cancelling keeps every payment and expense counting. A retry with the same
    /// <c>Idempotency-Key</c> and body answers with the stored answer and moves nothing more.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="body">The new status; a null or unreadable body is reported as a field error.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the whole order, 400 when the status is not one of the seven, 401 without a valid token, 404 when the order does not exist or was deleted, 409 when two saves lost a race twice, or 422 when the owner's rules refuse the move.</returns>
    [HttpPost("{id:guid}/status")]
    [EndpointName("ChangeOrderStatus")]
    [ProducesResponseType<OrderDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> ChangeStatus(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] ChangeOrderStatusRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await changeStatus.HandleAsync(id, body ?? ChangeOrderStatusRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static order => TypedResults.Ok(order));
    }

    /// <summary>
    /// Deletes one order, both roles. The order stays in the database with its items, payments, refunds, discounts, expenses and
    /// history, but it and all of them leave every read: the order, its status and every child route answer 404, and its money counts
    /// nowhere. Who deleted it and when are recorded. It takes no version: it acts on the latest state, and deleting an order that is
    /// already deleted is a 404 that changes nothing. Only a Manager can see it in the deleted list and restore it.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 404 when the order does not exist or is already deleted, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [EndpointName("DeleteOrder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> DeleteOrder(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Lists the deleted orders, Managers only, most recently deleted first and then by id. Each row has the number, customer, team,
    /// status, total, paid and balance, and who deleted it and when. The total covers every page.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <param name="page">The page number, from 1 to 100000.</param>
    /// <param name="pageSize">Rows per page, from 1 to 100; 20 when not sent.</param>
    /// <returns>200 with the page, 400 for a bad page or page size, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpGet("deleted")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("ListDeletedOrders")]
    [ProducesResponseType<DeletedOrderListResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> ListDeletedOrders(
        CancellationToken cancellationToken,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = ListDeletedOrdersRequest.DefaultPageSize)
    {
        var result = await listDeleted.HandleAsync(new ListDeletedOrdersRequest(page, pageSize), cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static orders => TypedResults.Ok(orders));
    }

    /// <summary>
    /// Restores a deleted order, Managers only: it and all its items, payments, refunds, discounts, expenses and history count and
    /// show again. It takes no version. Restoring an order that is not deleted answers 404 and changes nothing. A retry with the
    /// same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when no deleted order has that id, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/restore")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("RestoreOrder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> RestoreOrder(Guid id, CancellationToken cancellationToken)
    {
        var result = await restore.HandleAsync(id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes one order for good, Managers only, whether or not it was deleted before. The order and every item, payment, refund,
    /// discount, expense and history row are removed from the database in one step and there is no way back. The query value
    /// <c>confirm</c> must be the order number typed exactly (same letters, no extra spaces), or nothing is removed. The audit log
    /// keeps one entry with the number, status, money figures and the user ids of the people who took payments, paid expenses and
    /// handed refunds back, and never customer details or notes. It takes no version, and removing an order that is already gone
    /// is a 404 that changes nothing. Image cleanup joins this delete when orders have images.
    /// </summary>
    /// <param name="id">The order id.</param>
    /// <param name="confirm">The order number, typed exactly.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 400 on <c>confirm</c> when it is not the exact number, 401 without a valid token, 403 for an Admin, 404 when no such order exists, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}/permanent")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("PermanentlyDeleteOrder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> PermanentlyDeleteOrder(Guid id, [FromQuery] string? confirm, CancellationToken cancellationToken)
    {
        var result = await permanentlyDelete.HandleAsync(id, confirm, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}
