namespace Csps.Application.Maintenance;

/// <summary>The time one maintenance pass may use, measured with a <see cref="TimeProvider"/> so tests drive it with a fake clock.</summary>
public sealed class MaintenanceBudget
{
    /// <summary>The default length of a pass: 90 seconds.</summary>
    public static readonly TimeSpan DefaultDuration = TimeSpan.FromSeconds(90);

    private readonly TimeProvider _time;
    private readonly DateTimeOffset _deadline;

    /// <summary>Initializes a new instance of the <see cref="MaintenanceBudget"/> class.</summary>
    /// <param name="time">The clock.</param>
    /// <param name="duration">How long the pass may take; the default when null. Must be positive.</param>
    /// <exception cref="ArgumentOutOfRangeException"><paramref name="duration"/> is zero or negative.</exception>
    public MaintenanceBudget(TimeProvider time, TimeSpan? duration = null)
    {
        ArgumentNullException.ThrowIfNull(time);
        var length = duration ?? DefaultDuration;
        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(length, TimeSpan.Zero, nameof(duration));

        _time = time;
        _deadline = time.GetUtcNow() + length;
    }

    /// <summary>Gets a value indicating whether the pass has used all its time.</summary>
    public bool IsSpent => _time.GetUtcNow() >= _deadline;

    /// <summary>Gets the time left; zero once spent.</summary>
    public TimeSpan Remaining => IsSpent ? TimeSpan.Zero : _deadline - _time.GetUtcNow();
}
