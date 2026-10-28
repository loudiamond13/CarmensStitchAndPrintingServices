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
[ApiController]
[Route("api/v1/product-types")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductTypesController(ListOrderListHandler list, CreateOrderListEntryHandler create, GetOrderListEntryHandler get) : ControllerBase
{
    /// <summary>
    /// Lists every product type, retired ones included with status <c>retired</c>, A to Z ignoring letter case, then by id. Pickers
    /// hide retired ones; filters keep them. Each item has <c>id</c>, <c>name</c>, <c>tone</c>, <c>status</c> (<c>active</c> or
    /// <c>retired</c>) and <c>isOthers</c>, which is always false for product types.
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
    /// <returns>201 with the product type and its location, 400 for field errors, 401 without a valid token, or 403 for an Admin.</returns>
    [HttpPost]
    [Authorize(Policy = Policies.Manager)]
    [EndpointName("CreateProductType")]
    [ProducesResponseType<OrderListEntryDetailResponse>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
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
}
