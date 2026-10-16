using System.Text.Json;

namespace Csps.ArchitectureTests;

/// <summary>
/// Rules for the two free GitHub security checks of the public repository (owner approval 2026-10-16, quick task
/// 261016-pub): CodeQL code scanning in codeql.yml and dependency review in hygiene.yml. The generic rules (pins,
/// timeouts, runners, no event data in run:) are in CiWorkflowTests and apply to these files too.
/// </summary>
public sealed class SecurityWorkflowTests
{
    private const string CodeqlPath = ".github/workflows/codeql.yml";
    private const string HygienePath = ".github/workflows/hygiene.yml";
    private const string WeeklyCron = "- cron: \"0 18 * * 0\"";

    private const string CodeqlCommit = "2892aa5e19bbd11bc0cff5427e3b750a04d9e3c2";
    private const string CodeqlVersion = "v4.38.2";
    private const string DependencyReviewCommit = "a1d282b36b6f3519aa1f3fc636f609c47dddb294";
    private const string DependencyReviewVersion = "v5.0.0";

    private static readonly string[] CodeqlMatrix =
    [
        "include:",
        "- language: csharp",
        "build-mode: manual",
        "- language: javascript-typescript",
        "build-mode: none",
    ];

    [Fact]
    public void CodeqlWorkflowExistsAndIsNamed()
    {
        var lines = WorkflowText.Lines(CodeqlPath);

        lines.ShouldNotBeEmpty($"{CodeqlPath} must exist (owner approval 2026-10-16).");
        lines.ShouldContain(line => line.TrimEnd() == "name: CodeQL");
    }

    [Fact]
    public void CodeqlRunsOnPullRequestsPushesAndAWeeklySchedule()
    {
        var lines = WorkflowText.Lines(CodeqlPath);
        var triggers = WorkflowText.Section(lines, "on");

        var pullRequest = WorkflowText.Section(triggers, "pull_request").Select(line => line.Trim()).ToList();
        var push = WorkflowText.Section(triggers, "push").Select(line => line.Trim()).ToList();
        var schedule = WorkflowText.Section(triggers, "schedule").Select(line => line.Trim()).ToList();

        pullRequest.ShouldBe(["branches: [main]"], customMessage: "CodeQL scans every pull request to main.");
        push.ShouldBe(["branches: [main]"], customMessage: "CodeQL scans every push to main.");
        schedule.Count.ShouldBe(1, "One weekly schedule.");
        triggers.Any(line => line.TrimStart().StartsWith("paths", StringComparison.Ordinal)).ShouldBeFalse("A path filter would skip the scan and report no check.");

        var cron = schedule[0];
        cron.ShouldBe("- cron: \"23 19 * * 0\"", "Sunday 19:00 UTC, a quiet time.");
        cron.ShouldNotBe(WeeklyCron, "The CodeQL run must not start at the same minute as the all-engine weekly run.");
        WorkflowText.Section(WorkflowText.Lines(".github/workflows/weekly.yml"), "on").Select(line => line.Trim()).ShouldContain(WeeklyCron);
    }

    [Fact]
    public void CodeqlStartsFromNoPermissionsAndTheJobAsksForTwo()
    {
        var lines = WorkflowText.Lines(CodeqlPath);
        lines.ShouldContain(line => line.TrimEnd() == "permissions: {}");

        var job = AnalyzeJob();
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).Order(StringComparer.Ordinal).ToList()
            .ShouldBe(["contents: read", "security-events: write"], customMessage: "Scanning reads the code and writes alerts to the Security tab, nothing else (T-03-02).");
    }

    [Fact]
    public void CodeqlJobIsBoundedAndPinned()
    {
        var job = AnalyzeJob().Lines.Select(line => line.Trim()).ToList();

        job.ShouldContain("runs-on: ubuntu-24.04");
        job.ShouldContain(line => line.StartsWith("timeout-minutes: ", StringComparison.Ordinal));
        job.ShouldContain("fail-fast: false", "One language failing must not hide the other's result.");

        WorkflowText.Section(AnalyzeJob().Lines, "matrix").Select(line => line.Trim()).ToList()
            .ShouldBe([.. CodeqlMatrix], customMessage: "C# is built by hand and JavaScript/TypeScript needs no build.");
    }

    [Fact]
    public void CodeqlConcurrencyCancelsOnlySupersededPullRequestRuns()
    {
        var concurrency = WorkflowText.Section(WorkflowText.Lines(CodeqlPath), "concurrency").Select(line => line.Trim()).ToList();

        concurrency.ShouldContain("group: codeql-${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}");
        concurrency.ShouldContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
    }

    [Fact]
    public void CodeqlStepsCheckOutBuildAndAnalyzeInOrder()
    {
        var steps = WorkflowText.Steps(AnalyzeJob().Lines);
        var names = steps.Select(WorkflowText.StepName).ToList();

        names.ShouldBe(["checkout", "setup dotnet", "initialize codeql", "build csharp", "analyze"], customMessage: "The steps run in this order.");

        Step(steps, "checkout").ShouldContain("persist-credentials: false");

        var dotnet = Step(steps, "setup dotnet");
        dotnet.ShouldContain("if: matrix.language == 'csharp'");
        dotnet.ShouldContain("global-json-file: global.json", "CodeQL builds with the repository's own pinned SDK.");

        var init = Step(steps, "initialize codeql");
        init.ShouldContain($"uses: github/codeql-action/init@{CodeqlCommit} # {CodeqlVersion}");
        init.ShouldContain("languages: ${{ matrix.language }}");
        init.ShouldContain("build-mode: ${{ matrix.build-mode }}");

        var build = Step(steps, "build csharp");
        build.ShouldContain("if: matrix.language == 'csharp'");
        var script = string.Join('\n', build);
        script.ShouldContain("dotnet restore Csps.slnx --locked-mode");
        script.ShouldContain("dotnet build Csps.slnx --no-restore");
        script.ShouldContain("-p:UseSharedCompilation=false", customMessage: "CodeQL traces the compiler, so the shared build server stays off.");

        var analyze = Step(steps, "analyze");
        analyze.ShouldContain($"uses: github/codeql-action/analyze@{CodeqlCommit} # {CodeqlVersion}");
        analyze.ShouldContain("category: \"/language:${{ matrix.language }}\"");
    }

    [Fact]
    public void CodeqlActionsAreUsedAtTheApprovedCommitOnly()
    {
        var uses = WorkflowText.UsesValues(WorkflowText.Lines(CodeqlPath)).Where(value => value.StartsWith("github/codeql-action", StringComparison.Ordinal)).ToList();

        uses.Order(StringComparer.Ordinal).ToList().ShouldBe(
            [
                $"github/codeql-action/analyze@{CodeqlCommit} # {CodeqlVersion}",
                $"github/codeql-action/init@{CodeqlCommit} # {CodeqlVersion}",
            ],
            "Only init and analyze are approved, at the commit the v4.38.2 tag points to (not the tag object).");
    }

    [Fact]
    public void DependencyReviewRunsOnPullRequestsOnlyWithReadAccess()
    {
        var job = DependencyReviewJob();
        var lines = job.Lines.Select(line => line.Trim()).ToList();

        lines.ShouldContain("name: dependency review");
        lines.ShouldContain("if: github.event_name == 'pull_request'", "The review compares a base and a head, so it runs for pull requests only.");
        lines.ShouldContain("runs-on: ubuntu-24.04");
        lines.ShouldContain(line => line.StartsWith("timeout-minutes: ", StringComparison.Ordinal));
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).ShouldBe(["contents: read"], customMessage: "No pull-requests: write, so no PR comment.");
    }

    [Fact]
    public void DependencyReviewFailsOnAnyAdvisoryAndChecksLicensesAgainstTheAllowList()
    {
        var step = WorkflowText.Steps(DependencyReviewJob().Lines)
            .Single(candidate => candidate.Any(line => line.Contains("actions/dependency-review-action@", StringComparison.Ordinal)))
            .Select(line => line.Trim())
            .ToList();

        step.ShouldContain($"uses: actions/dependency-review-action@{DependencyReviewCommit} # {DependencyReviewVersion}");
        step.ShouldContain("fail-on-severity: low");
        step.ShouldContain("comment-summary-in-pr: never", "The token has no write access, so the summary stays on the run page.");
        step.ShouldNotContain(line => line.StartsWith("warn-only", StringComparison.Ordinal), "The review must be able to fail the check.");
        step.ShouldNotContain(line => line.StartsWith("deny-licenses", StringComparison.Ordinal), "The action ignores a deny list when an allow list is set.");
        step.ShouldNotContain(line => line.StartsWith("allow-dependencies-licenses", StringComparison.Ordinal), "No package is exempt from the license rule.");

        var allowLine = step.Single(line => line.StartsWith("allow-licenses: ", StringComparison.Ordinal));
        var allowed = allowLine["allow-licenses: ".Length..].Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        allowed.Order(StringComparer.Ordinal).ToList().ShouldBe([.. ProjectAllowList().Order(StringComparer.Ordinal)]);
    }

    [Fact]
    public void ApprovalIsRecordedInTheRegistry()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoRoot.PathOf("docs/dependencies.json")));
        var scopes = document.RootElement.GetProperty("approvals").EnumerateArray()
            .Where(entry => entry.GetProperty("date").GetString() == "2026-10-16")
            .Select(entry => entry.GetProperty("scope").GetString() ?? string.Empty)
            .ToList();

        scopes.ShouldNotBeEmpty("docs/dependencies.json needs an approvals entry dated 2026-10-16.");
        var scope = string.Join('\n', scopes);
        foreach (var expected in new[] { CodeqlCommit, CodeqlVersion, DependencyReviewCommit, DependencyReviewVersion, "MIT" })
        {
            scope.ShouldContain(expected);
        }
    }

    // The project allow-list: docs/dependencies.json policy, its two approved exceptions, and 0BSD (the web tools' extra, docs/dependencies.md).
    private static List<string> ProjectAllowList()
    {
        using var document = JsonDocument.Parse(File.ReadAllText(RepoRoot.PathOf("docs/dependencies.json")));
        var policy = document.RootElement.GetProperty("policy");
        return
        [
            .. policy.GetProperty("allowedLicenses").EnumerateArray().Select(item => item.GetString()!),
            .. policy.GetProperty("exceptions").EnumerateArray().Select(item => item.GetProperty("license").GetString()!),
            "0BSD",
        ];
    }

    private static List<string> Step(IReadOnlyList<IReadOnlyList<string>> steps, string name)
    {
        var step = steps.SingleOrDefault(candidate => WorkflowText.StepName(candidate) == name);
        step.ShouldNotBeNull($"{CodeqlPath} needs a step named {name}.");
        return step.Select(line => line.Trim()).ToList();
    }

    private static WorkflowJob AnalyzeJob()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(CodeqlPath)).SingleOrDefault(candidate => candidate.Id == "analyze");
        job.ShouldNotBeNull($"{CodeqlPath} needs a job with the id analyze.");
        return job;
    }

    private static WorkflowJob DependencyReviewJob()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(HygienePath)).SingleOrDefault(candidate => candidate.Id == "dependency-review");
        job.ShouldNotBeNull($"{HygienePath} needs a job with the id dependency-review.");
        return job;
    }
}
