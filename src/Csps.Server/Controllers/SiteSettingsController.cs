using Csps.Application.Content;
using Csps.Application.Security;
using Csps.Server.Http;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>Staff API for the site settings (D-29). Read-only in Phase 1.</summary>
/// <param name="handler">The use-case handler.</param>
[ApiController]
[Route("api/v1/site-settings")]
[Authorize(Policy = Policies.Staff)]
[Produces("application/json")]
public sealed class SiteSettingsController(GetSiteSettingsHandler handler) : ControllerBase
{
    /// <summary>Returns the site settings.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The settings, or the failure as ProblemDetails.</returns>
    [HttpGet]
    [EndpointName("GetSiteSettings")]
    [ProducesResponseType<SiteSettingsDto>(StatusCodes.Status200OK)]
    public async Task<IResult> Get(CancellationToken cancellationToken)
    {
        var result = await handler.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static dto => TypedResults.Ok(dto));
    }
}
