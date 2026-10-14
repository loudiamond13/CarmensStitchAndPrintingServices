using System.Text.Json;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Net.Http.Headers;

namespace Csps.Server.Http;

/// <summary>
/// Writes the public health response (D-23): overall status plus each check's name and status, nothing else.
/// Descriptions, durations, exception text, data and versions are never written.
/// </summary>
public static class MinimalHealthWriter
{
    /// <summary>Writes <paramref name="report"/> as minimal, non-cacheable JSON.</summary>
    /// <param name="context">The current HTTP context.</param>
    /// <param name="report">The health report to describe.</param>
    /// <returns>A task that completes when the body has been written.</returns>
    public static async Task WriteAsync(HttpContext context, HealthReport report)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(report);

        context.Response.ContentType = "application/json";
        context.Response.Headers[HeaderNames.CacheControl] = "no-store";

        // HEAD gets the same status and headers, without a body (RFC 9110 section 9.3.2).
        if (HttpMethods.IsHead(context.Request.Method))
        {
            return;
        }

        var body = context.Response.Body;
        await using var writer = new Utf8JsonWriter(body);
        writer.WriteStartObject();
        writer.WriteString("status", report.Status.ToString());
        writer.WriteStartArray("checks");
        foreach (var (name, entry) in report.Entries)
        {
            writer.WriteStartObject();
            writer.WriteString("name", name);
            writer.WriteString("status", entry.Status.ToString());
            writer.WriteEndObject();
        }

        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(context.RequestAborted).ConfigureAwait(false);
    }
}
