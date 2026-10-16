using System.Diagnostics;

namespace Csps.ArchitectureTests;

/// <summary>
/// OPS-05, T-03-34: the framework-dependent win-x64 package the deploy uses holds no developer log and no Development
/// settings, and still holds what the host needs to start.
/// </summary>
[Collection(DotnetBuildCollection.Name)]
public sealed class PublishOutputTests
{
    private static readonly TimeSpan PublishTimeout = TimeSpan.FromMinutes(10);

    [Fact]
    public async Task PublishHasNoDevLogsOrDevelopmentSettings()
    {
        var output = Path.Combine(Path.GetTempPath(), $"csps-publish-proof-{Guid.NewGuid():N}");
        var logs = RepoRoot.PathOf("src/Csps.Server/logs");
        var sentinel = Path.Combine(logs, $"publish-proof-{Guid.NewGuid():N}.json");
        try
        {
            // logs/ is git-ignored; the sentinel stands in for the developer's real log files.
            Directory.CreateDirectory(logs);
            await File.WriteAllTextAsync(sentinel, "{}", TestContext.Current.CancellationToken);

            await PublishAsync(output);

            Directory.Exists(Path.Combine(output, "logs")).ShouldBeFalse("The package must not carry a logs folder.");
            File.Exists(Path.Combine(output, "appsettings.Development.json")).ShouldBeFalse("The package must not carry Development settings.");
            File.Exists(Path.Combine(output, "appsettings.json")).ShouldBeTrue("The package must carry appsettings.json.");
            File.Exists(Path.Combine(output, "web.config")).ShouldBeTrue("The package must carry web.config.");
            File.Exists(Path.Combine(output, "Csps.Server.dll")).ShouldBeTrue("The package must carry Csps.Server.dll.");
            Directory.EnumerateFiles(output, "publish-proof-*", SearchOption.AllDirectories).ShouldBeEmpty("The sentinel log file must not be published.");
        }
        finally
        {
            File.Delete(sentinel);
            if (Directory.Exists(output))
            {
                Directory.Delete(output, recursive: true);
            }
        }
    }

    private static async Task PublishAsync(string output)
    {
        var start = new ProcessStartInfo("dotnet")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in new[]
        {
            "publish", RepoRoot.PathOf("src/Csps.Server/Csps.Server.csproj"), "-c", "Release", "-r", "win-x64",
            "--self-contained", "false", "-o", output, "-tl:off", "--nologo",
        })
        {
            start.ArgumentList.Add(argument);
        }

        using var process = Process.Start(start) ?? throw new InvalidOperationException("Could not start dotnet.");
        var standardOutput = process.StandardOutput.ReadToEndAsync(TestContext.Current.CancellationToken);
        var standardError = process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);

        using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        limit.CancelAfter(PublishTimeout);
        await process.WaitForExitAsync(limit.Token);

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"The win-x64 publish failed with exit code {process.ExitCode}.{Environment.NewLine}{await standardOutput}{Environment.NewLine}{await standardError}");
        }
    }
}

/// <summary>Tests that run dotnet build or publish on the Server project share its obj folder, so they run one at a time.</summary>
internal static class DotnetBuildCollection
{
    public const string Name = "dotnet build of the Server project";
}
