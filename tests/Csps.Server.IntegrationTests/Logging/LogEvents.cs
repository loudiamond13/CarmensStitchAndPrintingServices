using Csps.Testing;
using Serilog.Events;

namespace Csps.Server.IntegrationTests.Logging;

/// <summary>Finds Serilog request-completion events in a <see cref="CollectingSink"/>.</summary>
internal static class LogEvents
{
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan PollInterval = TimeSpan.FromMilliseconds(20);

    /// <summary>
    /// Waits for the single request-completion event logged for <paramref name="path"/>. TestServer hands the
    /// response to the client as soon as it starts, so the event written after the pipeline returns can arrive a
    /// moment later than the response.
    /// </summary>
    /// <param name="sink">The sink the API writes to.</param>
    /// <param name="path">The request path (no query string).</param>
    /// <param name="cancellationToken">The test cancellation token.</param>
    /// <returns>The one event whose <c>RequestPath</c> is <paramref name="path"/> and that has a <c>StatusCode</c>.</returns>
    public static async Task<LogEvent> RequestCompletionAsync(CollectingSink sink, string path, CancellationToken cancellationToken)
    {
        var waited = TimeSpan.Zero;
        while (true)
        {
            var matches = sink.Events.Where(logEvent => IsRequestCompletion(logEvent, path)).ToList();
            if (matches.Count > 0 || waited >= Timeout)
            {
                return matches.ShouldHaveSingleItem($"expected exactly one request-completion event for {path}");
            }

            await Task.Delay(PollInterval, cancellationToken);
            waited += PollInterval;
        }
    }

    /// <summary>Returns a scalar property's raw value, failing the test if the property is missing.</summary>
    /// <param name="logEvent">The event.</param>
    /// <param name="name">The property name.</param>
    /// <returns>The scalar value.</returns>
    public static object? Scalar(LogEvent logEvent, string name)
    {
        logEvent.Properties.TryGetValue(name, out var value).ShouldBeTrue($"the event should carry {name}");
        return value.ShouldBeOfType<ScalarValue>().Value;
    }

    private static bool IsRequestCompletion(LogEvent logEvent, string path) =>
        logEvent.Properties.ContainsKey("StatusCode")
        && logEvent.Properties.TryGetValue("RequestPath", out var requestPath)
        && requestPath is ScalarValue { Value: string value }
        && string.Equals(value, path, StringComparison.Ordinal);
}
