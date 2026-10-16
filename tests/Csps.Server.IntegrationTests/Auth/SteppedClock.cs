namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// A clock whose UTC time only moves when a test advances it, while timers and stopwatches stay real, so the response
/// floor and background sweeps still work. Used to test minute-scale rules without waiting.
/// </summary>
internal sealed class SteppedClock : TimeProvider
{
    private readonly DateTimeOffset _start = TimeProvider.System.GetUtcNow();
    private long _offsetTicks;

    /// <summary>Gets the instant the clock started at.</summary>
    public DateTimeOffset Start => _start;

    /// <summary>Moves the clock forward.</summary>
    /// <param name="by">How far.</param>
    public void Advance(TimeSpan by) => Interlocked.Add(ref _offsetTicks, by.Ticks);

    /// <inheritdoc />
    public override DateTimeOffset GetUtcNow() => _start + TimeSpan.FromTicks(Interlocked.Read(ref _offsetTicks));
}
