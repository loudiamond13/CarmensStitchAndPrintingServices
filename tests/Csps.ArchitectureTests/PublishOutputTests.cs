using System.Diagnostics;
using System.Text.Json;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>
/// OPS-05, T-03-34: the self-contained win-x64 package the deploy uses (the same publish as CI) holds no developer log and
/// no Development settings, carries its own runtime and starts it in-process behind the IIS http-to-https rule.
/// </summary>
[Collection(DotnetBuildCollection.Name)]
public sealed class PublishOutputTests
{
    private static readonly TimeSpan PublishTimeout = TimeSpan.FromMinutes(10);

    // The lowest ASP.NET Core the package may bundle; the host's own runtime is older (HOSTING-RECORD, runtime row).
    private static readonly Version MinimumAspNetCore = new(10, 0, 13);

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
            Directory.EnumerateFiles(output, "Csps.LegacyFitCheck*", SearchOption.AllDirectories).ShouldBeEmpty("The deploy package must not carry the legacy fit check (07.1 D-14).");
            File.Exists(Path.Combine(output, "hostfxr.dll")).ShouldBeTrue("The package must bundle the .NET runtime.");

            AssertWebConfig(XDocument.Load(Path.Combine(output, "web.config")));
            AssertBundledRuntime(Path.Combine(output, "Csps.Server.runtimeconfig.json"));
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

    private static void AssertWebConfig(XDocument webConfig)
    {
        var aspNetCore = webConfig.Descendants("aspNetCore").ShouldHaveSingleItem();
        aspNetCore.Attribute("processPath").ShouldNotBeNull().Value.ShouldBe(@".\Csps.Server.exe", "IIS must start the bundled runtime, not the host's dotnet.");
        aspNetCore.Attribute("hostingModel").ShouldNotBeNull().Value.ShouldBe("inprocess");

        var rule = webConfig.Descendants("rewrite").Elements("rules").Elements("rule").ShouldHaveSingleItem();
        rule.Attribute("name").ShouldNotBeNull().Value.ShouldBe("HttpToHttps");

        var compression = webConfig.Descendants("urlCompression").ShouldHaveSingleItem();
        compression.Attribute("doStaticCompression").ShouldNotBeNull().Value.ShouldBe("false");
        compression.Attribute("doDynamicCompression").ShouldNotBeNull().Value.ShouldBe("false");
    }

    private static void AssertBundledRuntime(string runtimeConfigPath)
    {
        using var document = JsonDocument.Parse(File.ReadAllText(runtimeConfigPath));
        var options = document.RootElement.GetProperty("runtimeOptions");

        options.TryGetProperty("framework", out _).ShouldBeFalse("A self-contained app names no shared framework.");
        options.TryGetProperty("frameworks", out _).ShouldBeFalse("A self-contained app names no shared frameworks.");
        options.TryGetProperty("includedFrameworks", out var included).ShouldBeTrue("A self-contained app lists the frameworks it bundles.");

        var aspNetCore = included.EnumerateArray()
            .SingleOrDefault(framework => framework.GetProperty("name").GetString() == "Microsoft.AspNetCore.App");
        aspNetCore.ValueKind.ShouldBe(JsonValueKind.Object, "The package must bundle ASP.NET Core.");
        var version = Version.Parse(aspNetCore.GetProperty("version").GetString().ShouldNotBeNull());
        version.ShouldBeGreaterThanOrEqualTo(MinimumAspNetCore);
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
            "--self-contained", "true", "-o", output, "-tl:off", "--nologo",
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
