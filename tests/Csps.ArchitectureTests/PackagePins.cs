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
    private const string DependencySectionSuffix = "dependencies";

    // Every section npm installs from (npm 7+ installs peerDependencies automatically and optionalDependencies by
    // default), plus overrides. Bundled-name sections are arrays of names (or a bundle-all flag), not name/version maps.
    private static readonly string[] NpmSections =
        ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies", "overrides"];

    private static readonly string[] NpmBundleSections = ["bundleDependencies", "bundledDependencies"];

    /// <summary>Reads all PackageVersion, GlobalPackageReference, tool and npm pins from the repository.</summary>
    public static List<PackagePin> ReadAll() =>
        [
            .. ReadPackagesProps(File.ReadAllText(RepoRoot.PathOf(PackagesPropsPath))),
            .. ReadToolManifest(File.ReadAllText(RepoRoot.PathOf(ToolManifestPath))),
            .. ReadNpmManifest(File.ReadAllText(RepoRoot.PathOf(WebManifestPath)), "web"),
            .. ReadNpmManifest(File.ReadAllText(RepoRoot.PathOf(OpenApiGenManifestPath)), "tools/openapi-gen"),
        ];

    /// <summary>
    /// Parses the dependencies, devDependencies, optionalDependencies, peerDependencies, overrides and bundled names
    /// of an npm package.json. An <c>npm:</c> alias resolves to the real package and version
    /// (<c>"typescript": "npm:@typescript/typescript6@6.0.2"</c> is <c>@typescript/typescript6</c> 6.0.2). Ids are
    /// qualified by <paramref name="manifest"/>, so the same package in two manifests never collides. A package listed
    /// twice at the same version (a devDependency that is also an override) is one pin. The version text is kept as
    /// written; the registry check rejects anything but an exact version. A bundled name that no section pins becomes
    /// a pin with no version, so it still meets the registry gate.
    /// </summary>
    /// <exception cref="InvalidDataException">
    /// The manifest has a top-level <c>*dependencies</c> section this reader does not know (fail closed, NET-WR-05).
    /// </exception>
    public static List<PackagePin> ReadNpmManifest(string json, string manifest)
    {
        using var document = JsonDocument.Parse(json);
        RefuseUnknownDependencySections(document.RootElement, manifest);
        var pins = new List<PackagePin>();
        var pinnedNames = new HashSet<string>(StringComparer.Ordinal);
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
                pinnedNames.Add(package.Name);
                AddOnce(pins, new PackagePin($"{manifest}:{name}", version, NpmSource));
            }
        }

        foreach (var section in NpmBundleSections)
        {
            // An array of names; true/false (bundle all or none of the dependencies) adds no name of its own.
            if (!document.RootElement.TryGetProperty(section, out var names) || names.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            foreach (var name in names.EnumerateArray())
            {
                var text = name.ValueKind == JsonValueKind.String ? name.GetString()! : name.GetRawText();
                if (!pinnedNames.Contains(text))
                {
                    AddOnce(pins, new PackagePin($"{manifest}:{text}", string.Empty, NpmSource));
                }
            }
        }

        return pins;
    }

    private static void AddOnce(List<PackagePin> pins, PackagePin pin)
    {
        if (!pins.Contains(pin))
        {
            pins.Add(pin);
        }
    }

    private static void RefuseUnknownDependencySections(JsonElement root, string manifest)
    {
        foreach (var property in root.EnumerateObject())
        {
            if (property.Name.EndsWith(DependencySectionSuffix, StringComparison.OrdinalIgnoreCase)
                && !NpmSections.Contains(property.Name, StringComparer.Ordinal)
                && !NpmBundleSections.Contains(property.Name, StringComparer.Ordinal))
            {
                throw new InvalidDataException(
                    $"{manifest}/package.json has the dependency section '{property.Name}', which the pin reader does not know; add it to PackagePins so its packages meet the registry gate.");
            }
        }
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
