using System.Text.Json;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>
/// One pinned dependency: a central package version, a global analyzer reference, a local dotnet tool, or an npm
/// package. npm ids are qualified by their manifest folder (<c>web:vite</c>, <c>tools/openapi-gen:typescript</c>).
/// </summary>
internal sealed record PackagePin(string Id, string Version, string Source);

/// <summary>
/// Reads every pinned package and tool from Directory.Packages.props, .config/dotnet-tools.json and the two npm
/// manifests (web/package.json and tools/openapi-gen/package.json).
/// </summary>
internal static class PackagePins
{
    public const string PackagesPropsPath = "Directory.Packages.props";
    public const string ToolManifestPath = ".config/dotnet-tools.json";
    public const string WebManifestPath = "web/package.json";
    public const string OpenApiGenManifestPath = "tools/openapi-gen/package.json";
    public const string NpmSource = "npm";

    /// <summary>The npm manifest folders, as the registry's <c>manifest</c> field names them.</summary>
    public static readonly string[] NpmManifests = ["web", "tools/openapi-gen"];

    private const string NpmAliasPrefix = "npm:";
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
    /// Parses the dependencies, devDependencies and overrides of an npm package.json. An <c>npm:</c> alias resolves to
    /// the real package and version (<c>"typescript": "npm:@typescript/typescript6@6.0.2"</c> is
    /// <c>@typescript/typescript6</c> 6.0.2). Ids are qualified by <paramref name="manifest"/>, so the same package in
    /// two manifests never collides. A package listed twice at the same version (a devDependency that is also an
    /// override) is one pin. The version text is kept as written; the registry check rejects anything but an exact
    /// version.
    /// </summary>
    public static List<PackagePin> ReadNpmManifest(string json, string manifest)
    {
        using var document = JsonDocument.Parse(json);
        var pins = new List<PackagePin>();
        foreach (var section in NpmSections)
        {
            if (!document.RootElement.TryGetProperty(section, out var packages) || packages.ValueKind != JsonValueKind.Object)
            {
                continue;
            }

            foreach (var package in packages.EnumerateObject())
            {
                var spec = package.Value.ValueKind == JsonValueKind.String ? package.Value.GetString()! : string.Empty;
                var (name, version) = ResolveAlias(package.Name, spec.Trim());
                var pin = new PackagePin($"{manifest}:{name}", version, NpmSource);
                if (!pins.Contains(pin))
                {
                    pins.Add(pin);
                }
            }
        }

        return pins;
    }

    private static (string Name, string Version) ResolveAlias(string name, string spec)
    {
        if (!spec.StartsWith(NpmAliasPrefix, StringComparison.Ordinal))
        {
            return (name, spec);
        }

        var target = spec[NpmAliasPrefix.Length..];
        var at = target.LastIndexOf('@');
        return at > 0 ? (target[..at], target[(at + 1)..]) : (target, string.Empty);
    }

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
