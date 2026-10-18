namespace Csps.Testing;

/// <summary>
/// The shared two-writer helper (SEC-07): every aggregate with an edit version proves "two tabs, one winner" by sending
/// two requests that start at the same moment.
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

        var release = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var bothWaiting = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var waiting = 0;

        async Task<HttpResponseMessage> RunAsync(Func<Task<HttpResponseMessage>> send)
        {
            if (Interlocked.Increment(ref waiting) == 2)
            {
                bothWaiting.SetResult();
            }

            await release.Task.ConfigureAwait(false);
            return await send().ConfigureAwait(false);
        }

        var firstTask = Task.Run(() => RunAsync(first));
        var secondTask = Task.Run(() => RunAsync(second));

        await bothWaiting.Task.ConfigureAwait(false);
        release.SetResult();

        var responses = await Task.WhenAll(firstTask, secondTask).ConfigureAwait(false);
        return (responses[0], responses[1]);
    }
}
