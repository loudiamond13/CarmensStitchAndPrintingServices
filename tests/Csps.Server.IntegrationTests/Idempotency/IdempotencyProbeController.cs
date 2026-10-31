using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Server.Security;
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

    private TaskCompletionSource _started = new(TaskCreationOptions.RunContinuationsAsynchronously);
    private TaskCompletionSource _release = new(TaskCreationOptions.RunContinuationsAsynchronously);

    /// <summary>Gets a task that completes when a <c>hold</c> request has started.</summary>
    public Task Started => _started.Task;

    /// <summary>Prepares the next <c>hold</c> request: it will signal <see cref="Started"/> and wait for <see cref="Release"/>.</summary>
    public void Arm()
    {
        _started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        _release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
    }

    /// <summary>Lets the held request go on.</summary>
    public void Release() => _release.TrySetResult();

    /// <summary>Signals that the request started and waits until the test releases it.</summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes on release.</returns>
    public async Task HoldAsync(CancellationToken cancellationToken)
    {
        _started.TrySetResult();
        await _release.Task.WaitAsync(cancellationToken);
    }
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

    /// <summary>Like <see cref="Status"/>, but asks the gate to keep the business row although the answer is not stored.</summary>
    /// <param name="code">The status to answer.</param>
    /// <param name="write">The key of a row to add before answering.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>The status with a small JSON body.</returns>
    [HttpPost("keep/{code:int}")]
    public async Task<IActionResult> Keep(int code, [FromQuery] Guid write, CancellationToken cancellationToken)
    {
        var runs = probe.Run();
        context.Add(IdempotencyRecord.Create(write, null, "POST /probe/business-row", new byte[32], StatusCodes.Status200OK, null, null, null, TimeProvider.System.GetUtcNow()));
        await context.SaveChangesAsync(cancellationToken);
        IdempotencyOutcome.KeepChanges(HttpContext);
        return new ObjectResult(new { runs }) { StatusCode = code };
    }

    /// <summary>Counts a run, signals that it started, waits until the test releases it, adds a business row and answers 201.</summary>
    /// <param name="write">The key of the business row to add.</param>
    /// <param name="cancellationToken">Cancels the request.</param>
    /// <returns>201 with the run number.</returns>
    [HttpPost("hold")]
    public async Task<IActionResult> Hold([FromQuery] Guid write, CancellationToken cancellationToken)
    {
        var runs = probe.Run();
        await probe.HoldAsync(cancellationToken);
        context.Add(IdempotencyRecord.Create(write, null, "POST /probe/business-row", new byte[32], StatusCodes.Status200OK, null, null, null, TimeProvider.System.GetUtcNow()));
        await context.SaveChangesAsync(cancellationToken);
        return Created("/api/test/idempotency/items/7", new { runs });
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
