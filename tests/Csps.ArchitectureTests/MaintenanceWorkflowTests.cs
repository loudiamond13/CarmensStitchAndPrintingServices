using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// JOB-01 rules for the monthly maintenance run (01 D-10, D-21, D-22): a scheduled and manual workflow with no token
/// rights, one repository secret that reaches the script through env only, and the runbooks (threats T-09-54 to T-09-58).
/// </summary>
public sealed class MaintenanceWorkflowTests
{
    private const string WorkflowPath = ".github/workflows/maintenance.yml";
    private const string ScriptPath = "web/scripts/maintenance.mjs";
    private const string RunbookPath = "docs/operations/maintenance.md";
    private const string CiGuidePath = "docs/operations/ci.md";
    private const string KeyEntry = "MAINTENANCE_KEY: ${{ secrets.MAINTENANCE_KEY }}";
    private const string SiteEntry = "SITE_ORIGIN: ${{ vars.SITE_ORIGIN }}";

    private static readonly Regex ModuleReference = new(@"(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)'(?<module>[^']+)'", RegexOptions.CultureInvariant);

    [Fact]
    public void RunsMonthlyAndOnRunNowOnly()
    {
        var lines = WorkflowText.Lines(WorkflowPath);
        lines.ShouldNotBeEmpty($"{WorkflowPath} is the JOB-01 monthly run and must exist.");

        var triggers = WorkflowText.Section(lines, "on");
        triggers.Where(line => IndentOf(line) == 2).Select(line => line.Trim()).ToList()
            .ShouldBe(["schedule:", "workflow_dispatch:"], "D-21: the monthly schedule and Run now, never a push or a pull request.");
        WorkflowText.Section(triggers, "schedule").Select(line => line.Trim()).ToList()
            .ShouldBe(["- cron: \"17 19 1 * *\""], "19:17 UTC on the 1st is 03:17 Manila on the 2nd.");
    }

    [Fact]
    public void TheTokenHasNoRightsAtBothLevels()
    {
        WorkflowText.Lines(WorkflowPath).ShouldContain("permissions: {}", "The token starts with no rights (T-09-56).");

        var job = TheJob();
        job.Lines.ShouldContain("    permissions: {}", "The job asks for no rights either: it only calls the site (T-09-56).");
        job.Lines.ShouldNotContain(line => line.Contains(": read", StringComparison.Ordinal) || line.Contains(": write", StringComparison.Ordinal));
    }

    [Fact]
    public void OneJobOnAPinnedRunnerWithATimeoutAndNoEnvironment()
    {
        var lines = WorkflowText.Lines(WorkflowPath);
        WorkflowText.Jobs(lines).Select(job => job.Id).ToList().ShouldBe(["run"]);

        var job = TheJob();
        job.Lines.ShouldContain("    name: monthly maintenance");
        job.Lines.ShouldContain("    runs-on: ubuntu-24.04");
        job.Lines.ShouldContain("    timeout-minutes: 20");
        job.Lines.ShouldNotContain(line => line.TrimStart().StartsWith("if:", StringComparison.Ordinal), "A skipped job would hide a missed run.");
        lines.ShouldNotContain(
            line => line.TrimStart().StartsWith("environment:", StringComparison.Ordinal),
            "A production environment's required reviewer would hold every cron run (Pitfall 17).");
    }

    [Fact]
    public void RunsOneAfterAnotherAndNeverCancels()
    {
        WorkflowText.Section(WorkflowText.Lines(WorkflowPath), "concurrency").Select(line => line.Trim()).ToList()
            .ShouldBe(["group: maintenance", "cancel-in-progress: false"], "Pressing Run now twice runs the two one after the other, and a running call is never cancelled.");
    }

    [Fact]
    public void UsesOnlyTheApprovedCheckoutAndSetupNode()
    {
        var job = TheJob();
        WorkflowText.StepNames(job.Lines).ShouldBe(["checkout", "setup node", "run maintenance"]);

        var uses = WorkflowText.UsesValues(job.Lines);
        uses.Count.ShouldBe(2);
        uses[0].ShouldStartWith("actions/checkout@");
        uses[1].ShouldStartWith("actions/setup-node@");

        var steps = WorkflowText.Steps(job.Lines);
        steps[0].Select(line => line.Trim()).ShouldContain("persist-credentials: false");
        var node = steps[1].Select(line => line.Trim()).ToList();
        node.ShouldContain("node-version: \"24.21.0\"");
        node.ShouldNotContain(line => line.StartsWith("cache", StringComparison.Ordinal), "The script uses Node built-ins only, so no npm package is installed or cached.");
    }

    [Fact]
    public void TheKeyAndTheSiteReachTheScriptThroughEnvOnly()
    {
        var lines = WorkflowText.Lines(WorkflowPath);
        // The job id is also "run", so the run lines are read from the steps only.
        var steps = WorkflowText.Steps(TheJob().Lines);
        steps.SelectMany(WorkflowText.RunBlocks).ToList().ShouldBe(["node web/scripts/maintenance.mjs"], "The job has one run line, the script.");

        var step = steps.Single(candidate => WorkflowText.StepName(candidate) == "run maintenance");
        WorkflowText.Section(step, "env").Select(line => line.Trim()).ToList()
            .ShouldBe([KeyEntry, SiteEntry], "The key and the origin are env entries of the run step, nothing else (T-09-54, T-09-55).");

        lines.Where(line => line.Contains("${{", StringComparison.Ordinal)).Select(line => line.Trim()).ToList()
            .ShouldBe([KeyEntry, SiteEntry], "No other expression appears anywhere in the file.");
        lines.Where(line => line.Contains("secrets.", StringComparison.Ordinal)).Select(line => line.Trim()).ToList()
            .ShouldBe([KeyEntry], "MAINTENANCE_KEY is the only secret the workflow reads.");
    }

    [Fact]
    public void NoOtherWorkflowReadsTheMaintenanceKey()
    {
        var offenders = WorkflowText.Files()
            .Where(path => path != WorkflowPath)
            .Where(path => WorkflowText.Lines(path).Any(line => line.Contains("MAINTENANCE_KEY", StringComparison.Ordinal)))
            .ToList();

        offenders.ShouldBeEmpty("The maintenance key belongs to maintenance.yml alone (01 D-10, D-21).");
    }

    [Fact]
    public void TheScriptUsesBuiltInsOnly()
    {
        var imports = ScriptLines()
            .Where(line => !line.TrimStart().StartsWith("//", StringComparison.Ordinal))
            .SelectMany(line => ModuleReference.Matches(line).Select(match => match.Groups["module"].Value))
            .ToList();

        imports.ShouldNotBeEmpty($"{ScriptPath} imports nothing, so the import reader is not working.");
        imports.Where(module => !module.StartsWith("node:", StringComparison.Ordinal)).ToList()
            .ShouldBeEmpty($"{ScriptPath} runs without npm ci, so it may import only node: built-ins (T-09-SC).");
    }

    [Fact]
    public void TheRunbooksDescribeTheWorkflow()
    {
        var runbook = string.Join('\n', WorkflowText.Lines(RunbookPath));
        foreach (var phrase in new[] { "17 19 1 * *", "Run now", "60 days", "delayed", "red run", "MAINTENANCE_KEY", "SITE_ORIGIN" })
        {
            runbook.ShouldContain(phrase, Case.Sensitive, $"{RunbookPath} must explain: {phrase}.");
        }

        var guide = string.Join('\n', WorkflowText.Lines(CiGuidePath));
        foreach (var phrase in new[] { "maintenance.yml", "monthly maintenance", "run maintenance" })
        {
            guide.ShouldContain(phrase, Case.Sensitive, $"{CiGuidePath} must describe the maintenance workflow: {phrase}.");
        }
    }

    private static WorkflowJob TheJob()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(WorkflowPath)).SingleOrDefault(candidate => candidate.Id == "run");
        job.ShouldNotBeNull("maintenance.yml needs a job with the id run.");
        return job;
    }

    private static string[] ScriptLines() => File.ReadAllLines(RepoRoot.PathOf(ScriptPath));

    private static int IndentOf(string line) => line.Length - line.TrimStart(' ').Length;
}
