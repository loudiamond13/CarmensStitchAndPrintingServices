using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The product lines an order can be shown under (D-09, D-16). Admin and Manager may both read it, because both may show an order; the
/// rest of <c>api/v1/product-lines</c> is Manager only, so this route has its own controller and its own policy. Never cached.
/// </summary>
/// <param name="listOptions">The list handler.</param>
[ApiController]
[Route("api/v1/product-lines/options")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class ProductLineOptionsController(ListProductLineOptionsHandler listOptions) : ControllerBase
{
    /// <summary>Lists the active product lines in display order, each with its id, title and short name. Hidden lines are not listed.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the lines, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("ListProductLineOptions")]
    [ProducesResponseType<IReadOnlyList<ProductLineOptionDto>>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> List(CancellationToken cancellationToken)
    {
        var result = await listOptions.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static items => TypedResults.Ok(items));
    }
}
