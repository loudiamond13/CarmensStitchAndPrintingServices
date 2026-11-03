using Csps.Application.Orders;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>The photo rules of an order (ORD-04, IMG-02): staff of either role read the limits the upload enforces. Never cached.</summary>
/// <param name="rules">The rules handler.</param>
[ApiController]
[Route("api/v1/orders/image-rules")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class OrderImageRulesController(GetImageRulesHandler rules) : ControllerBase
{
    /// <summary>
    /// Reads the photo rules: <c>maxPerOrder</c> (5), <c>maxBytes</c>, <c>maxPixels</c>, <c>maxSide</c>, <c>types</c>
    /// (<c>jpeg</c>, <c>png</c>, <c>webp</c>, <c>heic</c>) and <c>descriptionMaxLength</c>. The upload enforces the same values, so a
    /// client that checks them first sends no file the server would refuse for size or type.
    /// </summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the rules, or 401 without a valid token.</returns>
    [HttpGet]
    [EndpointName("GetImageRules")]
    [ProducesResponseType<ImageRulesResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await rules.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }
}
