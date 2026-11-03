using Csps.Application.Maintenance;
using Csps.Server.Http;
using Csps.Server.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// The scheduled maintenance call (JOB-01, D-21). GitHub Actions calls it with the secret key; no client or person does, so it is left
/// out of the OpenAPI description. Never cached.
/// </summary>
/// <param name="run">The run handler.</param>
[ApiController]
[Route("api/v1/maintenance")]
[Produces("application/json")]
[ApiExplorerSettings(IgnoreApi = true)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class MaintenanceController(RunMaintenanceHandler run) : ControllerBase
{
    /// <summary>Runs every maintenance job once, in order, and answers plain counts.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>200 with the run summary, or 401 when the key is missing or wrong.</returns>
    [HttpPost("run")]
    [AllowAnonymous]
    [RequireMaintenanceKey]
    [IdempotencyExempt("A scheduled machine call with no body; each run is guarded by a database lease, so a repeat is harmless.")]
    [EndpointName("RunMaintenance")]
    [ProducesResponseType<MaintenanceRunResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IResult> Run(CancellationToken cancellationToken)
    {
        var result = await run.HandleAsync(cancellationToken).ConfigureAwait(false);
        return result.ToHttpResult(HttpContext, static response => TypedResults.Ok(response));
    }
}
