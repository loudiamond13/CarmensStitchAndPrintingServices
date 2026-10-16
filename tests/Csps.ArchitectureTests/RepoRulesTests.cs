namespace Csps.ArchitectureTests;

/// <summary>Repository rules written down as files: code owners, the PR template and .gitignore (OPS-01, D-08, D-09, D-16).</summary>
public sealed partial class RepoRulesTests
{
    private const string Owner = "@loudiamond13";
    private const string TemplatePath = ".github/pull_request_template.md";
    private const string DefinitionOfDoneHeading = "## Definition of Done";
    private const string LocalGateHeading = "## Local full gate";

    // One key phrase per PRD section 22 item, in PRD order.
    private static readonly string[] DefinitionOfDoneKeys =
    [
        "traced in the SUMMARY",
        "written first",
        "Zero warnings",
        "Architecture tests pass",
        "CSPS-UI-SPEC.md",
        "performance budgets",
        "module services",
        "WCAG 2.2 AA",
        "Security",
        "Comments",
        "Production data",
        "/gsd-secure-phase",
    ];

    private static readonly string[] LocalGateCommands =
    [
        "dotnet build Csps.slnx",
        "dotnet test --solution Csps.slnx",
        "Invoke-CoverageGate.ps1",
        "npm --prefix web run verify",
        "npm --prefix web run e2e",
    ];

    private static readonly string[] PrdGitignoreEntries =
    [
        "_local/",
        "*.bak",
        "*.mdf",
        "*.ldf",
        "appsettings.*.local.json",
        ".env*",
        "secrets.json",
        "playwright-report/",
        "test-results/",
        "src/Csps.Server/wwwroot/",
    ];

    [Fact]
    public void CodeownersNamesTheOwner()
    {
        var lines = ReadLines(".github/CODEOWNERS");

        lines.ShouldContain($"* {Owner}");
        lines.ShouldContain($"/.github/ {Owner}");
    }

    [Fact]
    public void TemplateCarriesTheDefinitionOfDone()
    {
        var lines = ReadLines(TemplatePath);
        lines.ShouldContain(DefinitionOfDoneHeading);

        var section = SectionOf(lines, DefinitionOfDoneHeading);
        var items = section.Where(line => line.StartsWith("- [", StringComparison.Ordinal)).ToList();

        items.Count.ShouldBe(DefinitionOfDoneKeys.Length, "The PRD section 22 list has 12 items.");
        items.Where(line => !line.StartsWith("- [ ] ", StringComparison.Ordinal))
            .ShouldBeEmpty("Every Definition of Done line starts unticked.");

        var lastIndex = -1;
        var missing = new List<string>();
        foreach (var key in DefinitionOfDoneKeys)
        {
            var index = items.FindIndex(item => item.Contains(key, StringComparison.Ordinal));
            if (index <= lastIndex)
            {
                missing.Add(key);
            }
            else
            {
                lastIndex = index;
            }
        }

        missing.ShouldBeEmpty("Each PRD item appears once, in PRD order.");

        var security = items.Single(item => item.Contains("Security", StringComparison.Ordinal));
        security.ShouldContain("analyzers and ESLint clean");
        security.ShouldContain("CodeQL is not available on the free private repo");
        items.Count(item => item.Contains("CodeQL clean", StringComparison.Ordinal)).ShouldBe(0);
    }

    [Fact]
    public void TemplateHasTheLocalGateSection()
    {
        var lines = ReadLines(TemplatePath);
        lines.ShouldContain(LocalGateHeading);

        var section = SectionOf(lines, LocalGateHeading);
        var missing = LocalGateCommands
            .Where(command => !section.Any(line => line.Contains(command, StringComparison.Ordinal)))
            .ToList();

        missing.ShouldBeEmpty("The five D-16 commands are listed.");
        section.Where(line => line.Contains("exit 0", StringComparison.Ordinal))
            .ShouldBeEmpty("The template must not pre-fill a passing exit code.");
        section.Where(line => line.StartsWith("- [", StringComparison.Ordinal))
            .ShouldBeEmpty("The local gate lines are not task-list lines.");
    }

    [Fact]
    public void TemplateKeepsTimestampsOutOfThePrBody()
    {
        var lines = ReadLines(TemplatePath);

        lines.ShouldNotBeEmpty();
        var first = lines[0];
        first.ShouldStartWith("<!--");
        first.ShouldContain("Created:");
        first.ShouldContain("Updated:");
        first.TrimEnd().ShouldEndWith("-->");
        first.ShouldNotBe("---");
    }

    [Fact]
    public void TemplateAsksForAConventionalTitle()
    {
        var lines = ReadLines(TemplatePath);

        lines.ShouldContain(line =>
            line.Contains("Conventional Commits", StringComparison.Ordinal)
            && line.Contains("type(scope): summary", StringComparison.Ordinal));
    }

    [Fact]
    public void GitignoreHasThePrdEntries()
    {
        var lines = ReadLines(".gitignore").Select(line => line.Trim()).ToList();

        var missing = PrdGitignoreEntries.Where(entry => !lines.Contains(entry)).ToList();

        missing.ShouldBeEmpty("CSPS-PRD.md section 18 entries must stay in .gitignore.");
    }

    // A missing file reads as no lines, so a test fails on its assertion rather than on an IO error.
    private static string[] ReadLines(string relativePath)
    {
        var path = RepoRoot.PathOf(relativePath);
        return File.Exists(path) ? File.ReadAllLines(path) : [];
    }

    private static List<string> SectionOf(string[] lines, string heading)
    {
        var start = Array.IndexOf(lines, heading);
        return start < 0
            ? []
            : lines.Skip(start + 1).TakeWhile(line => !line.StartsWith("## ", StringComparison.Ordinal)).ToList();
    }
}
