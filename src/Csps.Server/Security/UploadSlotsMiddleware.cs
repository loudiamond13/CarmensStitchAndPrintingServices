using System.Globalization;
using System.Threading.RateLimiting;
using Csps.Server.Http;

namespace Csps.Server.Security;

/// <summary>
/// The app-wide caps on photo uploads at a time (T-09-27, CWE-770). Staff uploads share one pool of two at a time with four waiting.
/// The anonymous quote photo upload has its own pool (<see cref="PublicUploadSlots"/>, D-39), so visitors can never take a staff slot
/// and a full staff pool never refuses a visitor. It runs after authorization, so a refused staff request never takes a slot; a
/// public upload takes one before its key is checked, which is why its pool is small and apart. A full pool is answered with the same
/// 429 the address limits give.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class UploadSlotsMiddleware(RequestDelegate next)
{
    private const int UploadsAtOnce = 2;
    private const int UploadsWaiting = 4;
    private const int BusyRetrySeconds = 60;

    /// <summary>Creates the limiter that holds the staff slots; one per app.</summary>
    /// <returns>The slot limiter.</returns>
    public static ConcurrencyLimiter CreateLimiter() => new(new ConcurrencyLimiterOptions
    {
        PermitLimit = UploadsAtOnce,
        QueueLimit = UploadsWaiting,
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
    });

    /// <summary>Holds a slot for an endpoint marked <see cref="UploadSlotAttribute"/> until the response is written; any other request passes through.</summary>
    /// <param name="context">The request.</param>
    /// <param name="staffSlots">The app's staff slot limiter.</param>
    /// <param name="publicSlots">The slots of anonymous visitors.</param>
    /// <returns>A task that completes when the request is done.</returns>
    public async Task InvokeAsync(HttpContext context, ConcurrencyLimiter staffSlots, PublicUploadSlots publicSlots)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(staffSlots);
        ArgumentNullException.ThrowIfNull(publicSlots);

        var mark = context.GetEndpoint()?.Metadata.GetMetadata<UploadSlotAttribute>();
        if (mark is null)
        {
            await next(context).ConfigureAwait(false);
            return;
        }

        var slots = mark.Pool == UploadSlotPool.Public ? publicSlots.Limiter : staffSlots;
        using var lease = await slots.AcquireAsync(1, context.RequestAborted).ConfigureAwait(false);
        if (!lease.IsAcquired)
        {
            context.Response.Headers.RetryAfter = BusyRetrySeconds.ToString(CultureInfo.InvariantCulture);
            var problem = CspsProblemDetails.Build(context, StatusCodes.Status429TooManyRequests, RateLimitingRegistration.UploadsBusyDetail, code: RateLimitingRegistration.RateLimitedCode);
            await TypedResults.Problem(problem).ExecuteAsync(context).ConfigureAwait(false);
            return;
        }

        await next(context).ConfigureAwait(false);
    }
}
