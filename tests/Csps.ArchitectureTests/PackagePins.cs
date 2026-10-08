using System.Text.Json;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>One pinned dependency: a central package version, a global analyzer reference, or a local dotnet tool.</summary>
internal sealed record PackagePin(string Id, string Version, string Source);

/// <summary>Reads every pinned package and tool from Directory.Packages.props and .config/dotnet-tools.json.</summary>
internal static class PackagePins
{
    public const string PackagesPropsPath = "Directory.Packages.props";
    public const string ToolManifestPath = ".config/dotnet-tools.json";
    public const string WebManifestPath = "web/package.json";
    public const string OpenApiGenManifestPath = "tools/openapi-gen/package.json";

    /// <summary>Parses the npm pins of one package.json. Not implemented yet (RED placeholder).</summary>
    public static List<PackagePin> ReadNpmManifest(string json, string manifestFolder) => [];

    /// <summary>True when an npm pin is one exact x.y.z version. Not implemented yet (RED placeholder).</summary>
    public static bool IsExactNpmVersion(string version) => false;

    /// <summary>Reads all PackageVersion, GlobalPackageReference and tool pins from the repository.</summary>
    public static List<PackagePin> ReadAll() =>
        [
            .. ReadPackagesProps(File.ReadAllText(RepoRoot.PathOf(PackagesPropsPath))),
            .. ReadToolManifest(File.ReadAllText(RepoRoot.PathOf(ToolManifestPath))),
        ];

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
