using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>Strict build configuration rules (QUAL-01) and the forbidden-package list (PC-8).</summary>
public sealed partial class BuildConfigTests
{
    private static readonly string[] ForbiddenExactIds =
    [
        "MediatR",
        "AutoMapper",
        "FluentAssertions",
        "FluentValidation.AspNetCore",
        "Microsoft.AspNetCore.SpaProxy",
        "coverlet.collector",
        "Microsoft.Testing.Extensions.CodeCoverage",
        "Serilog.Sinks.MSSqlServer",
        "NetArchTest.Rules",
    ];

    private static readonly string[] ForbiddenIdPrefixes = ["Swashbuckle.", "NSwag."];

    private static readonly string[] RequiredBannedSymbols =
    [
        "P:System.DateTime.Now",
        "P:System.DateTime.UtcNow",
        "P:System.DateTime.Today",
        "P:System.DateTimeOffset.Now",
        "P:System.DateTimeOffset.UtcNow",
        "T:System.Random",
    ];

    private static readonly string[] ProjectRoots = ["src", "tests", "tools"];

    [Theory]
    [InlineData("TreatWarningsAsErrors", "true")]
    [InlineData("MSBuildTreatWarningsAsErrors", "true")]
    [InlineData("Nullable", "enable")]
    [InlineData("AnalysisLevel", "latest-recommended")]
    [InlineData("EnforceCodeStyleInBuild", "true")]
    [InlineData("NuGetAudit", "true")]
    [InlineData("NuGetAuditMode", "all")]
    [InlineData("RestorePackagesWithLockFile", "true")]
    public void DirectoryBuildPropsSetsStrictProperty(string property, string expected)
    {
        var props = XDocument.Load(RepoRoot.PathOf("Directory.Build.props"));

        var values = props.Descendants()
            .Where(element => string.Equals(element.Name.LocalName, property, StringComparison.Ordinal))
            .Select(element => element.Value.Trim())
            .ToList();

        values.ShouldContain(expected, $"Directory.Build.props must set {property} to {expected}.");
    }

    [Fact]
    public void DirectoryBuildPropsFeedsBannedSymbolsToTheAnalyzer()
    {
        var props = XDocument.Load(RepoRoot.PathOf("Directory.Build.props"));

        var additionalFiles = props.Descendants()
            .Where(element => string.Equals(element.Name.LocalName, "AdditionalFiles", StringComparison.Ordinal))
            .Select(element => (string?)element.Attribute("Include") ?? string.Empty);

        additionalFiles.ShouldContain(include => include.EndsWith("BannedSymbols.txt", StringComparison.Ordinal));
    }

    [Fact]
    public void BannedSymbolsListsTheSixBannedApis()
    {
        var symbols = File.ReadAllLines(RepoRoot.PathOf("BannedSymbols.txt"))
            .Select(line => line.Split(';')[0].Trim())
            .Where(symbol => symbol.Length > 0)
            .ToList();

        foreach (var required in RequiredBannedSymbols)
        {
            symbols.ShouldContain(required);
        }
    }

    [Fact]
    public void EditorConfigMarksMigrationsAsGeneratedCode()
    {
        var lines = File.ReadAllLines(RepoRoot.PathOf(".editorconfig")).Select(line => line.Trim()).ToList();

        var section = lines.IndexOf("[src/Csps.Infrastructure/Persistence/Migrations/**.cs]");
        section.ShouldBeGreaterThanOrEqualTo(0, "The root-relative migrations section is missing (research Pitfall 4).");
        lines.Skip(section + 1)
            .TakeWhile(line => !line.StartsWith('['))
            .ShouldContain("generated_code = true");
    }

    [Fact]
    public void GlobalJsonPinsTheSdkAndTheTestingPlatform()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoRoot.PathOf("global.json")));
        var root = document.RootElement;

        root.GetProperty("sdk").GetProperty("version").GetString().ShouldBe("10.0.401");
        root.GetProperty("sdk").GetProperty("rollForward").GetString().ShouldBe("latestPatch");
        root.GetProperty("test").GetProperty("runner").GetString().ShouldBe("Microsoft.Testing.Platform");
    }

    [Fact]
    public void EveryCentralPinIsAnExactVersion()
    {
        var loose = PackagePins.ReadPackagesProps(File.ReadAllText(RepoRoot.PathOf(PackagePins.PackagesPropsPath)))
            .Where(pin => !ExactVersion().IsMatch(pin.Version))
            .Select(pin => $"{pin.Id} {pin.Version}")
            .ToList();

        loose.ShouldBeEmpty("Central pins must be exact major.minor.patch versions.");
    }

    [Fact]
    public void NoProjectPinsAVersionOutsideCentralManagement()
    {
        var offenders = ProjectFiles()
            .SelectMany(path => XDocument.Load(path).Descendants()
                .Where(element => string.Equals(element.Name.LocalName, "PackageReference", StringComparison.Ordinal)
                    && (element.Attribute("Version") is not null || element.Attribute("VersionOverride") is not null))
                .Select(element => $"{ToRepoRelative(path)}: {(string?)element.Attribute("Include")}"))
            .ToList();

        offenders.ShouldBeEmpty("Versions belong in Directory.Packages.props only.");
    }

    [Fact]
    public void NoForbiddenPackageIsReferenced()
    {
        var files = ProjectFiles()
            .Append(RepoRoot.PathOf(PackagePins.PackagesPropsPath))
            .Append(RepoRoot.PathOf("Directory.Build.props"))
            .Append(RepoRoot.PathOf("tests/Directory.Build.props"));

        var ids = files
            .SelectMany(path => XDocument.Load(path).Descendants()
                .Where(element => element.Name.LocalName is "PackageReference" or "PackageVersion" or "GlobalPackageReference")
                .Select(element => (string?)element.Attribute("Include") ?? (string?)element.Attribute("Update") ?? string.Empty))
            .Concat(PackagePins.ReadToolManifest(File.ReadAllText(RepoRoot.PathOf(PackagePins.ToolManifestPath))).Select(pin => pin.Id));

        var forbidden = ids.Where(IsForbidden).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        forbidden.ShouldBeEmpty("These packages are forbidden by the project constraints (PC-8).");
    }

    private static bool IsForbidden(string id) =>
        ForbiddenExactIds.Contains(id, StringComparer.OrdinalIgnoreCase)
        || ForbiddenIdPrefixes.Any(prefix => id.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));

    private static List<string> ProjectFiles() =>
        ProjectRoots
            .Select(RepoRoot.PathOf)
            .Where(Directory.Exists)
            .SelectMany(directory => Directory.EnumerateFiles(directory, "*.csproj", SearchOption.AllDirectories))
            .Where(path => !IsUnderBuildOutput(path))
            .ToList();

    private static bool IsUnderBuildOutput(string path)
    {
        var segments = ToRepoRelative(path).Split('/');
        return segments.Contains("bin", StringComparer.OrdinalIgnoreCase)
            || segments.Contains("obj", StringComparer.OrdinalIgnoreCase);
    }

    private static string ToRepoRelative(string fullPath) =>
        Path.GetRelativePath(RepoRoot.Find(), fullPath).Replace('\\', '/');

    [GeneratedRegex(@"^\d+\.\d+\.\d+$", RegexOptions.CultureInvariant)]
    private static partial Regex ExactVersion();
}
