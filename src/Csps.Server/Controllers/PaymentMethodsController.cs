using Csps.Application.OrderLists;
using Csps.Application.Security;
using Csps.Domain.OrderLists;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>The payment methods orders point at (D-16): staff of either role read the list, and only Managers add or change them (D-19). Never cached.</summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add-an-entry handler (Managers only).</param>
/// <param name="get">The single-entry read handler (Managers only).</param>
/// <param name="update">The rename-and-recolor handler (Managers only).</param>
/// <param name="retire">The retire handler (Managers only).</param>
/// <param name="reactivate">The bring-back handler (Managers only).</param>
/// <param name="delete">The delete handler (Managers only).</param>
[ApiController]
[Route("api/v1/payment-methods")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class PaymentMethodsController(ListOrderListHandler list, CreateOrderListEntryHandler create, GetOrderListEntryHandler get, UpdateOrderListEntryHandler update, RetireOrderListEntryHandler retire, ReactivateOrderListEntryHandler reactivate, DeleteOrderListEntryHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists every payment method, retired ones included with status <c>retired</c>, A to Z ignoring letter case, then by id. Pickers
    /// hide retired ones; filters keep them. Each item has <c>id</c>, <c>name</c>, <c>tone</c>, <c>status</c> (<c>active</c> or
    /// <c>retired</c>), <c>isOthers</c>, which is always false for payment methods, and <c>useCount</c>, the number of payments
    /// that use the method, soft-deleted orders included.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the payment methods, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListPaymentMethods")]
    [ProducesResponseType<IReadOnlyList<OrderListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(OrderListKind.PaymentMethod, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>
    /// Adds a payment method, Managers only. The name is required, at most 40 characters and unique among all payment methods, retired
    /// ones included, ignoring letter case. The tone is one of six: <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>,
    /// <c>warning</c> or <c>success</c>. Staff can pick the new method on an order at once. Who added it and when come from the token
    /// and the clock; any such member in the body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the
    /// stored 201 and adds nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the payment method and its location, 400 for field errors, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("CreatePaymentMethod")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] OrderListEntryRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(OrderListKind.PaymentMethod, body ?? OrderListEntryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/payment-methods/{created.Id:D}", created));
    }

    /// <summary>Reads one payment method with how many payments use it, who recorded and last changed it, and the version a save must send back. Managers only.</summary>
    /// <param name="id">The payment method id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the payment method, 401 without a valid token, 403 for an Admin, or 404 when it does not exist.</returns>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("GetPaymentMethod")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(OrderListKind.PaymentMethod, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static entry => TypedResults.Ok(entry));
    }

    /// <summary>
    /// Renames and recolors one payment method with the version the form was opened with, Managers only. The new name shows on every
    /// payment, past ones included. The name and tone follow the same rules as when adding. A version that is not the stored one
    /// answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form with no change saves nothing and
    /// keeps the version. Who changed it and when come from the token and the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="id">The payment method id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved payment method, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 for a stale version.</returns>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("UpdatePaymentMethod")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Update(
        Guid id,
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] OrderListEntryRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await update.HandleAsync(OrderListKind.PaymentMethod, id, body ?? OrderListEntryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Retires a payment method, Managers only: it can no longer be chosen on a new or changed payment but stays in the list and
    /// the filters, marked <c>retired</c>, and saved payments keep it. Retiring a retired method is a 204 that changes and records
    /// nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The payment method id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/retire")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("RetirePaymentMethod")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Retire(Guid id, CancellationToken cancellationToken)
    {
        var result = await retire.HandleAsync(OrderListKind.PaymentMethod, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Brings a retired payment method back, Managers only: it can be chosen on a payment again. Bringing back an active method is
    /// a 204 that changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with
    /// the stored 204.
    /// </summary>
    /// <param name="id">The payment method id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("ReactivatePaymentMethod")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await reactivate.HandleAsync(OrderListKind.PaymentMethod, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes a payment method, Managers only, while no payment uses it. A payment uses it when a row exists, payments of
    /// soft-deleted orders included. A used method answers 422 <c>payment-methods.in-use</c> and should be retired instead. It takes no
    /// version.
    /// </summary>
    /// <param name="id">The payment method id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, 422 for a used method, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("DeletePaymentMethod")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(OrderListKind.PaymentMethod, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}
