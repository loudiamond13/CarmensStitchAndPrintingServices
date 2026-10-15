using System.Diagnostics;
using Microsoft.AspNetCore.Http.Features;

namespace Csps.Server.Http;

/// <summary>
/// The id that ties a response to its log lines (FND-05). It is the W3C trace id of the request's own
/// <see cref="Activity"/> (from <see cref="IHttpActivityFeature"/>, so code that starts a nested root activity
/// cannot change it): 32 lowercase hex characters, the same value Serilog writes as the trace id.
/// </summary>
public static class CorrelationId
{
    // A private object key, so nothing else can read or overwrite the cached fallback id.
    private static readonly object FallbackKey = new();

    /// <summary>
    /// Returns the current request's trace id: the request's own activity, else <see cref="Activity.Current"/>. When
    /// neither exists, it returns a random W3C trace id instead, created on the first call and kept in <see cref="HttpContext.Items"/>, so every call for the same
    /// request returns the same 32 lowercase hex characters.
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>The correlation id for this request.</returns>
    public static string For(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        var activity = context.Features.Get<IHttpActivityFeature>()?.Activity ?? Activity.Current;
        if (activity is not null)
        {
            return activity.TraceId.ToHexString();
        }

        if (context.Items.TryGetValue(FallbackKey, out var cached) && cached is string id)
        {
            return id;
        }

        var fallback = ActivityTraceId.CreateRandom().ToHexString();
        context.Items[FallbackKey] = fallback;
        return fallback;
    }
}
