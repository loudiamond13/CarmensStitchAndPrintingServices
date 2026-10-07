using System.Collections.Concurrent;
using Serilog.Core;
using Serilog.Events;

namespace Csps.Testing;

/// <summary>
/// A thread-safe Serilog sink that keeps every event in memory so tests can assert on log output (FND-07).
/// <see cref="CspsApiFactory"/> registers it as an <see cref="ILogEventSink"/> in DI, and the API's
/// <c>ReadFrom.Services</c> attaches it to the logger.
/// </summary>
public sealed class CollectingSink : ILogEventSink
{
    private readonly ConcurrentQueue<LogEvent> _events = new();

    /// <summary>Gets a snapshot of the events written so far, in arrival order.</summary>
    public IReadOnlyList<LogEvent> Events => [.. _events];

    /// <inheritdoc />
    public void Emit(LogEvent logEvent)
    {
        ArgumentNullException.ThrowIfNull(logEvent);
        _events.Enqueue(logEvent);
    }
}
