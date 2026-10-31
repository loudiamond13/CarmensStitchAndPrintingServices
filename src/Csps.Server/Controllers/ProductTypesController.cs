using Csps.Application.OrderLists;
using Csps.Application.Security;
using Csps.Domain.OrderLists;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Csps.Server.Controllers;

/// <summary>The product types orders point at (D-18): staff of either role read the list, and only Managers add or change them (D-19). Never cached.</summary>
/// <param name="list">The list handler.</param>
/// <param name="create">The add-an-entry handler (Managers only).</param>
/// <param name="get">The single-entry read handler (Managers only).</param>
/// <param name="update">The rename-and-recolor handler (Managers only).</param>
/// <param name="retire">The retire handler (Managers only).</param>
/// <param name="reactivate">The bring-back handler (Managers only).</param>
/// <param name="delete">The delete handler (Managers only).</param>
[ApiController]
[Route("api/v1/product-types")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductTypesController(ListOrderListHandler list, CreateOrderListEntryHandler create, GetOrderListEntryHandler get, UpdateOrderListEntryHandler update, RetireOrderListEntryHandler retire, ReactivateOrderListEntryHandler reactivate, DeleteOrderListEntryHandler delete) : ControllerBase
{
    /// <summary>
    /// Lists every product type, retired ones included with status <c>retired</c>, A to Z ignoring letter case, then by id. Pickers
    /// hide retired ones; filters keep them. Each item has <c>id</c>, <c>name</c>, <c>tone</c>, <c>status</c> (<c>active</c> or
    /// <c>retired</c>), <c>isOthers</c>, which is always false for product types, and <c>useCount</c>, the number of order items
    /// that use the type, soft-deleted orders included.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the product types, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListProductTypes")]
    [ProducesResponseType<IReadOnlyList<OrderListItem>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await list.HandleAsync(OrderListKind.ProductType, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }

    /// <summary>
    /// Adds a product type, Managers only. The name is required, at most 40 characters and unique among all product types, retired
    /// ones included, ignoring letter case. The tone is one of six: <c>neutral</c>, <c>accent</c>, <c>info</c>, <c>mockup</c>,
    /// <c>warning</c> or <c>success</c>. Staff can pick the new type on an order at once. Who added it and when come from the token
    /// and the clock; any such member in the body is ignored. A retry with the same <c>Idempotency-Key</c> and body answers with the
    /// stored 201 and adds nothing more.
    /// </summary>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the product type and its location, 400 for field errors, 401 without a valid token, 403 for an Admin, or 409 when the save lost a deadlock.</returns>
    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("CreateProductType")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Create(
        [FromBody(EmptyBodyBehavior = EmptyBodyBehavior.Allow)] OrderListEntryRequest? body,
        CancellationToken cancellationToken)
    {
        var result = await create.HandleAsync(OrderListKind.ProductType, body ?? OrderListEntryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static created => TypedResults.Created($"/api/v1/product-types/{created.Id:D}", created));
    }

    /// <summary>Reads one product type with how many order items use it, who recorded and last changed it, and the version a save must send back. Managers only.</summary>
    /// <param name="id">The product type id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the product type, 401 without a valid token, 403 for an Admin, or 404 when it does not exist.</returns>
    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("GetProductType")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var result = await get.HandleAsync(OrderListKind.ProductType, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static entry => TypedResults.Ok(entry));
    }

    /// <summary>
    /// Renames and recolors one product type with the version the form was opened with, Managers only. The new name shows on every
    /// order item, past ones included. The name and tone follow the same rules as when adding. A version that is not the stored one
    /// answers 409 <c>edit.stale</c> and changes nothing; a form edit is never retried. A form with no change saves nothing and
    /// keeps the version. Who changed it and when come from the token and the clock; any such member in the body is ignored.
    /// </summary>
    /// <param name="id">The product type id.</param>
    /// <param name="body">The form; a null or unreadable body is reported as field errors.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the saved product type, 400 for field errors, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 for a stale version.</returns>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("UpdateProductType")]
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
        var result = await update.HandleAsync(OrderListKind.ProductType, id, body ?? OrderListEntryRequest.Empty, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static saved => TypedResults.Ok(saved));
    }

    /// <summary>
    /// Retires a product type, Managers only: it can no longer be chosen on a new or changed order item but stays in the list and
    /// the filters, marked <c>retired</c>, and saved items keep it. Retiring a retired type is a 204 that changes and records
    /// nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with the stored 204.
    /// </summary>
    /// <param name="id">The product type id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/retire")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("RetireProductType")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Retire(Guid id, CancellationToken cancellationToken)
    {
        var result = await retire.HandleAsync(OrderListKind.ProductType, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Brings a retired product type back, Managers only: it can be chosen on an order item again. Bringing back an active type is
    /// a 204 that changes and records nothing. It takes no version, and a retry with the same <c>Idempotency-Key</c> answers with
    /// the stored 204.
    /// </summary>
    /// <param name="id">The product type id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, or 409 when two saves lost a race.</returns>
    [HttpPost("{id:guid}/reactivate")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("ReactivateProductType")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IResult> Reactivate(Guid id, CancellationToken cancellationToken)
    {
        var result = await reactivate.HandleAsync(OrderListKind.ProductType, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }

    /// <summary>
    /// Deletes a product type, Managers only, while no order item uses it. An item uses it when a row exists, items of
    /// soft-deleted orders included. A used type answers 422 <c>product-types.in-use</c> and should be retired instead. It takes no
    /// version.
    /// </summary>
    /// <param name="id">The product type id.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204, 401 without a valid token, 403 for an Admin, 404 when it does not exist, 422 for a used type, or 409 when two saves lost a race.</returns>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("DeleteProductType")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var result = await delete.HandleAsync(OrderListKind.ProductType, id, cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static () => TypedResults.NoContent());
    }
}
