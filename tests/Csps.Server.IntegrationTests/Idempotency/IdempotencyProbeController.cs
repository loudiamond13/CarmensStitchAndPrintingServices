using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Csps.Server.IntegrationTests.Idempotency;

/// <summary>Counts how often the probe endpoints really ran, so a replay shows as "no new run".</summary>
public sealed class IdempotencyProbe
{
    private int _runs;

    /// <summary>Gets how many times a probe action has run.</summary>
    public int Runs => Volatile.Read(ref _runs);

    /// <summary>Records one run.</summary>
    /// <returns>The run number, starting at 1.</returns>
    public int Run() => Interlocked.Increment(ref _runs);
}

/// <summary>
/// Test-only covered POST endpoints that answer any status on demand. They exist only in hosts that add this assembly
/// as an application part, so the authorization matrix and the coverage discovery never see them.
/// </summary>
/// <param name="probe">The run counter.</param>
/// <param name="context">The request's scoped context, to write a business row.</param>
[ApiController]
[Route("api/test/idempotency")]
[AllowAnonymous]
[Produces("application/json")]
public sealed class IdempotencyProbeController(IdempotencyProbe probe, CspsDbContext context) : ControllerBase
{
    /// <summary>Answers <paramref name="code"/>; with <paramref name="write"/> it first adds a business row with that key.</summary>
    /// <param name="code">The status to answer.</param>
    /// <param name="write">When set, the key of a row to add before answering.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The status with a small JSON body.</returns>
    [HttpPost("status/{code:int}")]
    public async Task<IActionResult> Status(int code, [FromQuery] Guid? write, CancellationToken cancellationToken)
    {
        var runs = probe.Run();
        if (write is { } rowKey)
        {
            context.Add(IdempotencyRecord.Create(rowKey, null, "POST /probe/business-row", new byte[32], StatusCodes.Status200OK, null, null, null, TimeProvider.System.GetUtcNow()));
            await context.SaveChangesAsync(cancellationToken);
        }

        return code == StatusCodes.Status201Created
            ? Created("/api/test/idempotency/items/7", new { runs })
            : new ObjectResult(new { runs }) { StatusCode = code };
    }

    /// <summary>Answers a text body over 1 MB.</summary>
    /// <returns>The big body.</returns>
    [HttpPost("big")]
    public IActionResult Big()
    {
        probe.Run();
        return Content(new string('x', 1_200_000), "text/plain");
    }

    /// <summary>Answers 200 and sets a cookie.</summary>
    /// <returns>200 with a cookie.</returns>
    [HttpPost("cookie")]
    public IActionResult Cookie()
    {
        var runs = probe.Run();
        Response.Cookies.Append("probe", "1");
        return Ok(new { runs });
    }

    /// <summary>Throws.</summary>
    /// <returns>Never returns.</returns>
    [HttpPost("throw")]
    public IActionResult Throw()
    {
        probe.Run();
        throw new InvalidOperationException("Probe failure.");
    }

    /// <summary>Fails the way the framework does when a body read passes the size limit.</summary>
    /// <returns>Never returns.</returns>
    [HttpPost("too-large")]
    public IActionResult TooLarge()
    {
        probe.Run();
        throw new BadHttpRequestException("Request body too large.", StatusCodes.Status413PayloadTooLarge);
    }

    /// <summary>Answers 200 whatever the body is.</summary>
    /// <returns>200 with the run number.</returns>
    [HttpPost("echo")]
    public IActionResult Echo() => Ok(new { runs = probe.Run() });
}
