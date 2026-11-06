using Csps.Infrastructure.Images;
using Microsoft.Extensions.Configuration;

namespace Csps.CloudinarySetup;

/// <summary>
/// The owner's one-time Cloudinary setup (IMG-04, D-03): <c>dotnet run --project tools/Csps.CloudinarySetup -- --check</c> to look,
/// the same without <c>--check</c> to create the missing named sizes. The keys come from the Csps.Server user-secrets or the
/// <c>Cloudinary__</c> environment variables, never from an argument, and the command never prompts.
/// </summary>
public static class Program
{
    // The Server's user-secrets id, so the dev keys are shared with the site.
    private const string ServerUserSecretsId = "7d33a131-9aea-4f9c-90eb-213d2b59cbee";

    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(60);

    /// <summary>Runs the command with this process's console.</summary>
    /// <param name="args">None, or <c>--check</c>.</param>
    /// <returns>The exit code: 0 done, 1 a size is different, 2 keys not set, 3 Cloudinary did not accept the calls, 64 bad argument.</returns>
    public static async Task<int> Main(string[] args)
    {
        if (!CloudinarySetupCommand.TryReadArguments(args, out var checkOnly))
        {
            await Console.Error.WriteLineAsync(CloudinarySetupCommand.Usage).ConfigureAwait(false);
            return CloudinarySetupCommand.UsageError;
        }

        var configuration = new ConfigurationBuilder()
            .AddUserSecrets(ServerUserSecretsId)
            .AddEnvironmentVariables()
            .Build();
        var settings = new CloudinarySettings();
        configuration.GetSection(CloudinarySettings.SectionName).Bind(settings);

        using var clients = new SingleClientFactory(RequestTimeout);
        var command = new CloudinarySetupCommand(settings, clients);
        return await command.RunAsync(checkOnly, Console.Out, CancellationToken.None).ConfigureAwait(false);
    }

    // One plain HTTP client for the whole run; the command makes a few dozen calls at most.
    private sealed class SingleClientFactory(TimeSpan timeout) : IHttpClientFactory, IDisposable
    {
        private readonly HttpClient _client = new() { Timeout = timeout };

        public HttpClient CreateClient(string name) => _client;

        public void Dispose() => _client.Dispose();
    }
}
