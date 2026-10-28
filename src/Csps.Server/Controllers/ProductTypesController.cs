using Csps.Application.OrderLists;
using Csps.Application.Security;
using Csps.Domain.OrderLists;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>The product types orders point at (D-18): staff of either role read them. Never cached.</summary>
/// <param name="list">The list handler.</param>
[ApiController]
[Route("api/v1/product-types")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductTypesController(ListOrderListHandler list) : ControllerBase
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
}
