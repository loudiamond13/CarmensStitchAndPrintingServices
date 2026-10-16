namespace Csps.Application.Common;

/// <summary>A minimum response time, so a fast branch cannot be told from a slow one (CWE-204, D-39).</summary>
public static class ResponseFloor
{
    /// <summary>Waits until <paramref name="floor"/> has passed since <paramref name="startedTimestamp"/>.</summary>
    /// <param name="startedTimestamp">The <see cref="TimeProvider.GetTimestamp"/> value taken when the work began.</param>
    /// <param name="floor">The least total time.</param>
    /// <param name="time">The clock.</param>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the floor has been reached.</returns>
    public static async Task WaitAsync(long startedTimestamp, TimeSpan floor, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(time);

        // A timer can fire a few milliseconds early (Windows ticks are coarse), so measure again after every delay.
        TimeSpan remaining;
        while ((remaining = floor - time.GetElapsedTime(startedTimestamp)) > TimeSpan.Zero)
        {
            await Task.Delay(remaining, time, cancellationToken).ConfigureAwait(false);
        }
    }
}
