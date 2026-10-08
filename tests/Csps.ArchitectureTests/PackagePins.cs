using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>One pinned dependency: a central package version, a global analyzer reference, a local dotnet tool or an npm package.</summary>
internal sealed record PackagePin(string Id, string Version, string Source);

/// <summary>Reads every pinned package and tool from Directory.Packages.props, .config/dotnet-tools.json and the two npm manifests.</summary>
internal static partial class PackagePins
{
    public const string PackagesPropsPath = "Directory.Packages.props";
    public const string ToolManifestPath = ".config/dotnet-tools.json";
    public const string WebManifestPath = "web/package.json";
    public const string OpenApiGenManifestPath = "tools/openapi-gen/package.json";

    /// <summary>The package.json sections whose entries are pins: direct dependencies first, then the exact transitive overrides.</summary>
    private static readonly string[] NpmSections = ["dependencies", "devDependencies", "overrides"];

    /// <summary>Reads all PackageVersion, GlobalPackageReference, tool and npm pins from the repository.</summary>
    public static List<PackagePin> ReadAll() =>
        [
            .. ReadPackagesProps(File.ReadAllText(RepoRoot.PathOf(PackagesPropsPath))),
            .. ReadToolManifest(File.ReadAllText(RepoRoot.PathOf(ToolManifestPath))),
            .. ReadNpmManifest(File.ReadAllText(RepoRoot.PathOf(WebManifestPath)), "web"),
            .. ReadNpmManifest(File.ReadAllText(RepoRoot.PathOf(OpenApiGenManifestPath)), "tools/openapi-gen"),
        ];

    /// <summary>
    /// Parses the dependencies, devDependencies and overrides of one package.json. Ids are qualified by the manifest folder
    /// (<c>web/react</c>, <c>tools/openapi-gen/typescript</c>), so the same package in two manifests never collides. An alias
    /// <c>npm:&lt;name&gt;@x.y.z</c> is recorded as x.y.z. Any other spec is kept raw so the exactness test can name it. A
    /// pin repeated with the same version (a direct pin that is also an override) is kept once; a differing one is kept,
    /// so the registry reports the disagreement.
    /// </summary>
    public static List<PackagePin> ReadNpmManifest(string json, string manifestFolder)
    {
        using var document = JsonDocument.Parse(json);
        var pins = new List<PackagePin>();
        foreach (var section in NpmSections)
        {
            if (!document.RootElement.TryGetProperty(section, out var entries) || entries.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            foreach (var entry in entries.EnumerateObject())
            {
                var spec = entry.Value.ValueKind == JsonValueKind.String ? entry.Value.GetString() ?? string.Empty : entry.Value.GetRawText();
                var pin = new PackagePin($"{manifestFolder}/{entry.Name}", ExactVersionOf(spec), "npm");
                if (!pins.Contains(pin))
                {
                    pins.Add(pin);
                }
            }
        }

        return pins;
    }

    /// <summary>True when an npm pin is one exact x.y.z version (no range, tag, URL, path or pre-release).</summary>
    public static bool IsExactNpmVersion(string version) => ExactVersion().IsMatch(version);

    private static string ExactVersionOf(string spec)
    {
        var alias = AliasSpec().Match(spec);
        return alias.Success ? alias.Groups["version"].Value : spec;
    }

    [GeneratedRegex(@"^\d+\.\d+\.\d+$", RegexOptions.CultureInvariant)]
    private static partial Regex ExactVersion();

    [GeneratedRegex(@"^npm:(?:@[^/@\s]+/)?[^/@\s]+@(?<version>\d+\.\d+\.\d+)$", RegexOptions.CultureInvariant)]
    private static partial Regex AliasSpec();

    /// <summary>Parses PackageVersion and GlobalPackageReference items from props XML.</summary>
    public static List<PackagePin> ReadPackagesProps(string xml)
    {
        var document = XDocument.Parse(xml);
        return document.Descendants()
            .Where(element => element.Name.LocalName is "PackageVersion" or "GlobalPackageReference")
            .Select(element => new PackagePin(
                (string?)element.Attribute("Include") ?? string.Empty,
                (string?)element.Attribute("Version") ?? string.Empty,
                element.Name.LocalName))
            .ToList();
    }

    /// <summary>Parses the tools of a dotnet local tool manifest.</summary>
    public static List<PackagePin> ReadToolManifest(string json)
    {
        using var document = JsonDocument.Parse(json);
        if (!document.RootElement.TryGetProperty("tools", out var tools))
        {
            return [];
        }

        return tools.EnumerateObject()
            .Select(tool => new PackagePin(
                tool.Name,
                tool.Value.TryGetProperty("version", out var version) ? version.GetString() ?? string.Empty : string.Empty,
                "tool"))
            .ToList();
    }
}
