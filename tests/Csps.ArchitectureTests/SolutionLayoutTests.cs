using System.Text.Json;
using System.Xml.Linq;

namespace Csps.ArchitectureTests;

/// <summary>Solution layout rules (FND-02): one Csps.slnx, the onion projects, no VS scaffold left behind.</summary>
public sealed class SolutionLayoutTests
{
    private static readonly string[] ProjectRoots = ["src", "tests", "tools"];

    private static readonly string[] IgnoredDirectoryNames = ["bin", "obj", "node_modules", ".git", ".vs", "_local"];

    [Fact]
    public void SolutionListsTheFourProductionProjects()
    {
        var projects = SolutionProjects();

        projects.ShouldContain("src/Csps.Domain/Csps.Domain.csproj");
        projects.ShouldContain("src/Csps.Application/Csps.Application.csproj");
        projects.ShouldContain("src/Csps.Infrastructure/Csps.Infrastructure.csproj");
        projects.ShouldContain("src/Csps.Server/Csps.Server.csproj");
    }

    [Fact]
    public void EverySolutionProjectLivesUnderSrcTestsOrTools()
    {
        var misplaced = SolutionProjects()
            .Where(path => !ProjectRoots.Any(root => path.StartsWith(root + "/", StringComparison.Ordinal)))
            .ToList();

        misplaced.ShouldBeEmpty("Projects must live under src/, tests/ or tools/.");
    }

    [Fact]
    public void EveryProjectOnDiskIsListedInTheSolution()
    {
        var listed = SolutionProjects().ToHashSet(StringComparer.OrdinalIgnoreCase);

        var orphans = ProjectRoots
            .SelectMany(root => FindFiles(RepoRoot.PathOf(root), "*.csproj"))
            .Select(ToRepoRelative)
            .Where(path => !listed.Contains(path))
            .ToList();

        orphans.ShouldBeEmpty("Every project under src/, tests/ or tools/ must be listed in Csps.slnx.");
    }

    [Fact]
    public void VisualStudioScaffoldIsGone()
    {
        File.Exists(RepoRoot.PathOf("CarmensStitchAndPrintingServices.slnx")).ShouldBeFalse();
        Directory.Exists(RepoRoot.PathOf("CarmensStitchAndPrintingServices.Server")).ShouldBeFalse();
        Directory.Exists(RepoRoot.PathOf("carmensstitchandprintingservices.client")).ShouldBeFalse();
        FindFiles(RepoRoot.Find(), "*.esproj").ShouldBeEmpty("JavaScript project files (.esproj) belong to the removed scaffold.");
    }

    [Fact]
    public void LaunchSettingsUseTheProjectPortsWithoutSpaProxy()
    {
        var text = File.ReadAllText(RepoRoot.PathOf("src/Csps.Server/Properties/launchSettings.json"));
        using var document = JsonDocument.Parse(text);
        var profiles = document.RootElement.GetProperty("profiles");

        profiles.GetProperty("http").GetProperty("applicationUrl").GetString().ShouldBe("http://localhost:5115");
        profiles.GetProperty("https").GetProperty("applicationUrl").GetString()
            .ShouldBe("https://localhost:7028;http://localhost:5115");
        text.ShouldNotContain("ASPNETCORE_HOSTINGSTARTUPASSEMBLIES");
        text.ShouldNotContain("SpaProxy", Case.Insensitive);
    }

    private static List<string> SolutionProjects()
    {
        var solution = XDocument.Load(RepoRoot.PathOf(RepoRoot.SolutionFileName));
        return solution.Descendants()
            .Where(element => string.Equals(element.Name.LocalName, "Project", StringComparison.Ordinal))
            .Select(element => ((string?)element.Attribute("Path") ?? string.Empty).Replace('\\', '/'))
            .ToList();
    }

    private static string ToRepoRelative(string fullPath) =>
        Path.GetRelativePath(RepoRoot.Find(), fullPath).Replace('\\', '/');

    private static List<string> FindFiles(string directory, string pattern)
    {
        var results = new List<string>();
        if (!Directory.Exists(directory))
        {
            return results;
        }

        results.AddRange(Directory.EnumerateFiles(directory, pattern));
        foreach (var child in Directory.EnumerateDirectories(directory))
        {
            var name = Path.GetFileName(child);
            if (!IgnoredDirectoryNames.Contains(name, StringComparer.OrdinalIgnoreCase))
            {
                results.AddRange(FindFiles(child, pattern));
            }
        }

        return results;
    }
}
