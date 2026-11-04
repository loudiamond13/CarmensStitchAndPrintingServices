namespace Csps.Infrastructure.Images;

/// <summary>Placeholder so the tests compile; the real command follows in the next commit.</summary>
/// <param name="settings">The account settings.</param>
/// <param name="httpClients">Hands out the HTTP client.</param>
public sealed class CloudinarySetupCommand(CloudinarySettings settings, IHttpClientFactory httpClients)
{
    /// <summary>Does nothing yet.</summary>
    /// <param name="checkOnly">True to look only.</param>
    /// <param name="output">Receives the report.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The exit code.</returns>
    public Task<int> RunAsync(bool checkOnly, TextWriter output, CancellationToken cancellationToken) =>
        Task.FromResult(settings is null || httpClients is null ? -1 : 0);

    /// <summary>Does nothing yet.</summary>
    /// <param name="args">The arguments.</param>
    /// <param name="checkOnly">Set to the flag.</param>
    /// <returns>False.</returns>
    public static bool TryReadArguments(string[] args, out bool checkOnly)
    {
        checkOnly = false;
        return args is null;
    }
}
