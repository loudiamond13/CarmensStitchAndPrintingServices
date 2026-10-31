namespace Csps.Testing;

/// <summary>
/// The shared concurrent-writer helper (SEC-07, ORD-14): every aggregate with an edit version proves "two tabs, one winner" by sending
/// requests that start at the same moment.
/// </summary>
public static class ConcurrentRequests
{
    /// <summary>
    /// Starts both requests on the thread pool, holds each at a gate until both are waiting there, releases them
    /// together, and waits for both answers.
    /// </summary>
    /// <param name="first">Sends the first request.</param>
    /// <param name="second">Sends the second request.</param>
    /// <returns>The two responses, in the order the senders were given. The caller disposes them.</returns>
    public static async Task<(HttpResponseMessage First, HttpResponseMessage Second)> SendTogetherAsync(
        Func<Task<HttpResponseMessage>> first,
        Func<Task<HttpResponseMessage>> second)
    {
        ArgumentNullException.ThrowIfNull(first);
        ArgumentNullException.ThrowIfNull(second);

        var responses = await SendAllTogetherAsync([first, second]).ConfigureAwait(false);
        return (responses[0], responses[1]);
    }

    /// <summary>
    /// Starts every request on the thread pool, holds each at one gate until all are waiting there, releases them
    /// together, and waits for every answer.
    /// </summary>
    /// <param name="senders">One sender per request. At least one.</param>
    /// <returns>The responses, in the order the senders were given. The caller disposes them.</returns>
    public static async Task<IReadOnlyList<HttpResponseMessage>> SendAllTogetherAsync(IReadOnlyList<Func<Task<HttpResponseMessage>>> senders)
    {
        ArgumentNullException.ThrowIfNull(senders);
        ArgumentOutOfRangeException.ThrowIfZero(senders.Count);

        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var allWaiting = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var waiting = 0;

        async Task<HttpResponseMessage> RunAsync(Func<Task<HttpResponseMessage>> send)
        {
            if (Interlocked.Increment(ref waiting) == senders.Count)
            {
                allWaiting.SetResult();
            }

            await release.Task.ConfigureAwait(false);
            return await send().ConfigureAwait(false);
        }

        var tasks = senders.Select(sender => Task.Run(() => RunAsync(sender))).ToList();

        await allWaiting.Task.ConfigureAwait(false);
        release.SetResult();

        try
        {
            return await Task.WhenAll(tasks).ConfigureAwait(false);
        }
        catch
        {
            // A failed sender must not leave the other answers undisposed.
            foreach (var task in tasks.Where(static task => task.IsCompletedSuccessfully))
            {
                task.Result.Dispose();
            }

            throw;
        }
    }
}
