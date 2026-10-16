using System.Text.Json;

namespace Csps.ArchitectureTests;

/// <summary>Repository rules written down as files: code owners, the PR template and .gitignore (OPS-01, D-08, D-09, D-16).</summary>
public sealed partial class RepoRulesTests
{
    private const string Owner = "@loudiamond13";
    private const string TemplatePath = ".github/pull_request_template.md";
    private const string DefinitionOfDoneHeading = "## Definition of Done";
    private const string LocalGateHeading = "## Local full gate";
    private const string DependabotPath = ".github/dependabot.yml";

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
        security.ShouldContain("analyzers and ESLint clean", Case.Sensitive);
        security.ShouldContain("CodeQL scans run on the public repo", Case.Sensitive);
        security.ShouldNotContain("not available", Case.Sensitive);
    }

    [Fact]
    public void LicenseIsMitForTheOwner()
    {
        var lines = ReadLines("LICENSE");

        lines.ShouldNotBeEmpty("LICENSE is missing at the repository root.");
        lines[0].ShouldBe("MIT License");
        lines.ShouldContain("Copyright (c) 2026 loudiamond13");
        lines.ShouldContain(line => line.StartsWith("Permission is hereby granted, free of charge", StringComparison.Ordinal));
        lines.ShouldContain(line => line.StartsWith("THE SOFTWARE IS PROVIDED \"AS IS\"", StringComparison.Ordinal));
        ReadLines("README.md").ShouldContain(line => line.Contains("MIT License", StringComparison.Ordinal));
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
        section.Where(line => line.Contains("exit 0", StringComparison.Ordinal)
                && LocalGateCommands.Any(command => line.Contains(command, StringComparison.Ordinal)))
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
        first.ShouldStartWith("<!--", Case.Sensitive);
        first.ShouldContain("Created:", Case.Sensitive);
        first.ShouldContain("Updated:", Case.Sensitive);
        first.TrimEnd().ShouldEndWith("-->", Case.Sensitive);
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

    [Fact]
    public void BranchRulesDocCoversTheProcessGate()
    {
        var lines = ReadLines("docs/operations/branch-rules.md");
        var text = string.Join(Environment.NewLine, lines);

        string[] headings =
        [
            "## What is enforced today",
            "## Rules written down for later",
            "## How to merge",
            "## When CI minutes run out",
        ];
        headings.Where(heading => !lines.Contains(heading)).ShouldBeEmpty("Every section is present.");

        string[] names = ["Merge-PullRequest.ps1", "`gate (full)`", "D-08", "D-16"];
        names.Where(name => !text.Contains(name, StringComparison.Ordinal)).ShouldBeEmpty("Every key name is mentioned.");
    }

    [Fact]
    public void RulesetIsReadyToApply()
    {
        var path = RepoRoot.PathOf("docs/operations/main-ruleset.json");
        File.Exists(path).ShouldBeTrue("docs/operations/main-ruleset.json is missing.");

        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;

        root.GetProperty("name").GetString().ShouldBe("main");
        root.GetProperty("target").GetString().ShouldBe("branch");
        root.GetProperty("enforcement").GetString().ShouldBe("active");
        root.GetProperty("conditions").GetProperty("ref_name").GetProperty("include")
            .EnumerateArray().Select(item => item.GetString()).ShouldBe(["~DEFAULT_BRANCH"]);
        root.GetProperty("bypass_actors").GetArrayLength().ShouldBe(0, "No one bypasses the rules.");

        var rules = root.GetProperty("rules").EnumerateArray().ToList();
        var types = rules.Select(rule => rule.GetProperty("type").GetString()).ToList();
        types.ShouldContain("required_linear_history");
        types.ShouldContain("deletion");
        types.ShouldContain("non_fast_forward");

        var pullRequest = rules.Single(rule => rule.GetProperty("type").GetString() == "pull_request");
        pullRequest.GetProperty("parameters").GetProperty("required_approving_review_count").GetInt32().ShouldBe(0);

        var statusChecks = rules.Single(rule => rule.GetProperty("type").GetString() == "required_status_checks")
            .GetProperty("parameters");
        statusChecks.GetProperty("strict_required_status_checks_policy").GetBoolean().ShouldBeTrue();
        statusChecks.GetProperty("required_status_checks").EnumerateArray()
            .Select(check => check.GetProperty("context").GetString()).ShouldBe(["gate (full)"]);
    }

    [Theory]
    [InlineData("CLAUDE.md")]
    [InlineData(".claude/CLAUDE.md")]
    public void ClaudeFilesStateTheMergeRule(string file)
    {
        var text = string.Join(Environment.NewLine, ReadLines(file));

        text.ShouldContain("Merge-PullRequest.ps1", Case.Sensitive);
        text.ShouldContain("never `gh pr merge`", Case.Sensitive);
    }

    [Fact]
    public void DependabotCoversEveryEcosystem()
    {
        var lines = ReadLines(DependabotPath).Select(line => line.Trim()).Where(line => !IsCommentOrBlank(line)).ToList();
        lines.ShouldContain("version: 2");

        var entries = DependabotEntries();
        entries.Keys.ShouldBe(["nuget", "npm", "github-actions"], ignoreOrder: true, "Exactly three ecosystems.");

        entries["nuget"].ShouldContain("directory: \"/\"");
        entries["github-actions"].ShouldContain("directory: \"/\"");

        // Both npm manifests share one entry, so one grouped PR arrives instead of two racing ones.
        entries["npm"].ShouldContain("- \"/web\"");
        entries["npm"].ShouldContain("- \"/tools/openapi-gen\"");
        entries["npm"].ShouldContain("directories:");
    }

    [Fact]
    public void DependabotWaitsFourteenDays()
    {
        var entries = DependabotEntries();
        entries.Count.ShouldBe(3);

        var offenders = new List<string>();
        foreach (var (ecosystem, lines) in entries)
        {
            var prefix = ecosystem == "github-actions" ? "ci" : "build";
            string[] required =
            [
                "cooldown:",
                "default-days: 14",
                "interval: \"monthly\"",
                "groups:",
                "- \"*\"",
                $"prefix: \"{prefix}\"",
                "include: \"scope\"",
            ];
            offenders.AddRange(required.Where(line => !lines.Contains(line)).Select(line => $"{ecosystem}: {line}"));
        }

        offenders.ShouldBeEmpty("Every entry waits 14 days, runs monthly, groups all updates and uses a Conventional Commits prefix.");
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

    private static bool IsCommentOrBlank(string trimmedLine) =>
        trimmedLine.Length == 0 || trimmedLine.StartsWith('#');

    // Splits dependabot.yml into one list of trimmed, non-comment lines per package-ecosystem entry.
    private static Dictionary<string, List<string>> DependabotEntries()
    {
        const string Marker = "- package-ecosystem:";
        var entries = new Dictionary<string, List<string>>(StringComparer.Ordinal);
        List<string>? current = null;

        foreach (var line in ReadLines(DependabotPath).Select(line => line.Trim()).Where(line => !IsCommentOrBlank(line)))
        {
            if (line.StartsWith(Marker, StringComparison.Ordinal))
            {
                var name = line[Marker.Length..].Trim().Trim('"');
                current = [];
                entries[name] = current;
            }
            else
            {
                current?.Add(line);
            }
        }

        return entries;
    }
}
