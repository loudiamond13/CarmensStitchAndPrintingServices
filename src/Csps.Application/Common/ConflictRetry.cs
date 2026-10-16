namespace Csps.Application.Common;

/// <summary>Runs a unit of work that loads, decides and saves, and runs it once more when a save loses a race.</summary>
internal static class ConflictRetry
{
    /// <summary>Runs <paramref name="attempt"/>, then once more after a <see cref="ConcurrencyConflictException"/>.</summary>
    /// <typeparam name="T">The result type.</typeparam>
    /// <param name="attempt">Loads the data again, decides and saves.</param>
    /// <param name="whenBusy">The answer when the second pass also loses its race.</param>
    /// <returns>The result of the first pass that did not conflict, or <paramref name="whenBusy"/>.</returns>
    public static async Task<T> RunAsync<T>(Func<Task<T>> attempt, T whenBusy)
    {
        ArgumentNullException.ThrowIfNull(attempt);

        try
        {
            return await attempt().ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            // The unit of work dropped its tracked state, so the second pass reads what the other request saved.
        }

        try
        {
            return await attempt().ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            return whenBusy;
        }
    }
}
