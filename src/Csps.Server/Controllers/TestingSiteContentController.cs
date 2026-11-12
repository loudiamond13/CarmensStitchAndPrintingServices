#if CSPS_TESTING
using Csps.Infrastructure.Content;
using Csps.Server.Security;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Lets E2E specs put the demo business info and phone numbers back in place (QUAL-05, D-37). It exists in the Testing environment of a
/// Debug build only. The controller holds no database types: the seeder in Infrastructure does the work.
/// </summary>
/// <param name="seeder">Sets the demo content.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/site-content")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingSiteContentController(TestingSiteContentSeeder seeder) : ControllerBase
{
    /// <summary>Sets the demo settings and the two demo phone numbers; a repeat leaves the same rows.</summary>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>204 when the demo content is in place.</returns>
    [HttpPost]
    [IdempotencyExempt("Testing-only test data, compiled out of Release.")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IResult> Reset(CancellationToken cancellationToken)
    {
        await seeder.ResetAsync(cancellationToken).ConfigureAwait(false);
        return TypedResults.NoContent();
    }
}
#endif
