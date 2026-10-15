using System.Diagnostics;
using System.Reflection.Metadata;
using System.Reflection.Metadata.Ecma335;
using System.Reflection.PortableExecutable;
using System.Text;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>
/// QUAL-05, D-27, D-37: what the tests rely on to read mail and make staff users can never ship. A Release build of the
/// API holds no email sink, no Testing type and no Testing route, and the build symbol that compiles them in is defined
/// for the Debug configuration only.
/// </summary>
public sealed class ReleaseHasNoEmailSinkTests
{
    private const string TestingSymbol = "CSPS_TESTING";
    private const string DebugCondition = "'$(Configuration)'=='Debug'";

    private static readonly string[] ShippedAssemblies = ["Csps.Server.dll", "Csps.Infrastructure.dll"];
    private static readonly TimeSpan BuildTimeout = TimeSpan.FromMinutes(10);

    [Fact]
    public async Task ReleaseBuildHasNoTestingTypesOrRoutes()
    {
        var output = Path.Combine(Path.GetTempPath(), $"csps-release-proof-{Guid.NewGuid():N}");
        try
        {
            await BuildReleaseAsync(output);

            foreach (var assembly in ShippedAssemblies)
            {
                var path = Path.Combine(output, assembly);
                File.Exists(path).ShouldBeTrue($"{assembly} must be in the Release build output.");

                var offending = TypeNames(path).Where(static name =>
                    name.Contains("EmailSink", StringComparison.Ordinal) || name.StartsWith("Testing", StringComparison.Ordinal)).ToList();
                offending.ShouldBeEmpty($"{assembly} must hold no email sink or Testing type in a Release build.");

                UserStrings(path).Where(static text => text.Contains("/api/testing", StringComparison.OrdinalIgnoreCase)).ShouldBeEmpty(
                    $"{assembly} must hold no string with /api/testing.");

                // Attribute arguments such as [Route("api/testing/emails")] live in the blob heap, not in the user strings.
                var bytes = await File.ReadAllBytesAsync(path, TestContext.Current.CancellationToken);
                Contains(bytes, Encoding.UTF8.GetBytes("api/testing")).ShouldBeFalse($"{assembly} must not carry the Testing routes anywhere.");
                Contains(bytes, Encoding.Unicode.GetBytes("api/testing")).ShouldBeFalse($"{assembly} must not carry the Testing routes anywhere.");
            }
        }
        finally
        {
            if (Directory.Exists(output))
            {
                Directory.Delete(output, recursive: true);
            }
        }
    }

    [Fact]
    public void TestingSymbolIsDefinedOnlyForDebug()
    {
        var files = ProjectFiles().ToList();
        var definitions = 0;

        foreach (var file in files)
        {
            foreach (var element in XDocument.Load(file).Descendants().Where(static element => !element.HasElements && element.Value.Contains(TestingSymbol, StringComparison.Ordinal)))
            {
                definitions++;
                var conditions = element.AncestorsAndSelf().Select(static e => (string?)e.Attribute("Condition")).OfType<string>().Select(Squash).ToList();
                conditions.ShouldContain(DebugCondition, $"{Path.GetFileName(file)}: {element.Name.LocalName} defines {TestingSymbol} outside the Debug configuration.");
            }
        }

        definitions.ShouldBeGreaterThanOrEqualTo(2, "Both the Server and the Infrastructure project define the symbol.");
        File.ReadAllText(RepoRoot.PathOf("src/Csps.Server/Csps.Server.csproj")).ShouldContain(TestingSymbol);
        File.ReadAllText(RepoRoot.PathOf("src/Csps.Infrastructure/Csps.Infrastructure.csproj")).ShouldContain(TestingSymbol);
    }

    private static string Squash(string condition) => condition.Replace(" ", string.Empty, StringComparison.Ordinal);

    // Every project and build-props file in the repository outside build output and node_modules.
    private static IEnumerable<string> ProjectFiles()
    {
        var root = RepoRoot.Find();
        return Directory.EnumerateFiles(root, "*.*", SearchOption.AllDirectories)
            .Where(static path => path.EndsWith(".csproj", StringComparison.Ordinal)
                || path.EndsWith(".props", StringComparison.Ordinal)
                || path.EndsWith(".targets", StringComparison.Ordinal))
            .Where(path =>
            {
                var relative = Path.GetRelativePath(root, path).Replace('\\', '/');
                return !relative.Contains("/obj/", StringComparison.Ordinal)
                    && !relative.Contains("/bin/", StringComparison.Ordinal)
                    && !relative.Contains("node_modules/", StringComparison.Ordinal)
                    && !relative.StartsWith('.')
                    && File.ReadAllText(path).Contains(TestingSymbol, StringComparison.Ordinal);
            });
    }

    private static async Task BuildReleaseAsync(string output)
    {
        var start = new ProcessStartInfo("dotnet")
        {
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
        };
        foreach (var argument in new[] { "build", RepoRoot.PathOf("src/Csps.Server/Csps.Server.csproj"), "-c", "Release", "-o", output, "-tl:off", "--nologo" })
        {
            start.ArgumentList.Add(argument);
        }

        using var process = Process.Start(start) ?? throw new InvalidOperationException("Could not start dotnet.");
        var standardOutput = process.StandardOutput.ReadToEndAsync(TestContext.Current.CancellationToken);
        var standardError = process.StandardError.ReadToEndAsync(TestContext.Current.CancellationToken);

        using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        limit.CancelAfter(BuildTimeout);
        await process.WaitForExitAsync(limit.Token);

        if (process.ExitCode != 0)
        {
            throw new InvalidOperationException($"The Release build failed with exit code {process.ExitCode}.{Environment.NewLine}{await standardOutput}{Environment.NewLine}{await standardError}");
        }
    }

    private static List<string> TypeNames(string path)
    {
        using var stream = File.OpenRead(path);
        using var portable = new PEReader(stream);
        var reader = portable.GetMetadataReader();
        return [.. reader.TypeDefinitions.Select(handle => reader.GetString(reader.GetTypeDefinition(handle).Name))];
    }

    private static List<string> UserStrings(string path)
    {
        using var stream = File.OpenRead(path);
        using var portable = new PEReader(stream);
        var reader = portable.GetMetadataReader();
        var strings = new List<string>();
        for (var handle = MetadataTokens.UserStringHandle(0); !handle.IsNil; handle = reader.GetNextHandle(handle))
        {
            strings.Add(reader.GetUserString(handle));
        }

        return strings;
    }

    private static bool Contains(byte[] haystack, byte[] needle) => haystack.AsSpan().IndexOf(needle) >= 0;
}
