#if CSPS_TESTING
using Csps.Infrastructure.Email;
using Csps.Server.Testing;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.Controllers;

/// <summary>
/// Reads the mail the Testing sink received, so E2E tests can get sign-in codes and links (QUAL-05, D-27). It exists
/// in the Testing environment of a Debug build only.
/// </summary>
/// <param name="sink">The in-memory sink.</param>
[TestingOnly]
[ApiController]
[Route("api/testing/emails")]
[AllowAnonymous]
[Produces("application/json")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public sealed class TestingEmailsController(InMemoryEmailSink sink) : ControllerBase
{
    /// <summary>Returns the messages after a cursor, oldest first.</summary>
    /// <param name="after">The id of the last message already seen; 0 returns everything.</param>
    /// <param name="to">When set, only mail to this address.</param>
    /// <returns>The messages.</returns>
    [HttpGet]
    [ProducesResponseType<IReadOnlyList<SinkMessage>>(StatusCodes.Status200OK)]
    public IActionResult Get([FromQuery] long after = 0, [FromQuery] string? to = null) => Ok(sink.After(after, to));
}
#endif
