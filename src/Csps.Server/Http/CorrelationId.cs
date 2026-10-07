using System.Diagnostics;

namespace Csps.Server.Http;

/// <summary>
/// The id that ties a response to its log lines (FND-05). It is the W3C trace id of the request's
/// <see cref="Activity"/>: 32 lowercase hex characters, the same value Serilog writes as the trace id.
/// </summary>
public static class CorrelationId
{
    /// <summary>
    /// Returns the current request's trace id, or <see cref="HttpContext.TraceIdentifier"/> only when no
    /// <see cref="Activity"/> exists.
    /// </summary>
    /// <param name="context">The current HTTP context.</param>
    /// <returns>The correlation id for this request.</returns>
    public static string For(HttpContext context)
    {
        ArgumentNullException.ThrowIfNull(context);
        return Activity.Current is { } activity
            ? activity.TraceId.ToHexString()
            : context.TraceIdentifier;
    }
}
