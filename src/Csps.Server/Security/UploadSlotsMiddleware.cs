using System.Globalization;
using System.Threading.RateLimiting;
using Csps.Server.Http;

namespace Csps.Server.Security;

/// <summary>
/// The app-wide cap of two photo uploads at a time, with four waiting (T-09-27, CWE-770). It runs after authorization, so a refused
/// anonymous request never takes a slot. A full cap is answered with the same 429 the address limits give.
/// </summary>
/// <param name="next">The next middleware.</param>
public sealed class UploadSlotsMiddleware(RequestDelegate next)
{
    /// <summary>The endpoint name of the photo upload action.</summary>
    public const string UploadEndpointName = "UploadOrderImage";

    private const int UploadsAtOnce = 2;
    private const int UploadsWaiting = 4;
    private const int BusyRetrySeconds = 60;

    /// <summary>Creates the limiter that holds the slots; one per app.</summary>
    /// <returns>The slot limiter.</returns>
    public static ConcurrencyLimiter CreateLimiter() => new(new ConcurrencyLimiterOptions
    {
        PermitLimit = UploadsAtOnce,
        QueueLimit = UploadsWaiting,
        QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
    });

    /// <summary>Holds a slot for the upload endpoint until the response is written; any other request passes through.</summary>
    /// <param name="context">The request.</param>
    /// <param name="slots">The app's slot limiter.</param>
    /// <returns>A task that completes when the request is done.</returns>
    public async Task InvokeAsync(HttpContext context, ConcurrencyLimiter slots)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(slots);

        if (context.GetEndpoint()?.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName != UploadEndpointName)
        {
            await next(context).ConfigureAwait(false);
            return;
        }

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
