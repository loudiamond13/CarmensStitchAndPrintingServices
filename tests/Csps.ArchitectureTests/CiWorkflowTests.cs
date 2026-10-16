using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// OPS-02 rules over every file in .github/workflows: SHA pins, empty default permissions, timeouts, no injection
/// sinks, triggers and the order of the gate steps (threats T-03-01 to T-03-06).
/// </summary>
public sealed partial class CiWorkflowTests
{
    private const string CiPath = ".github/workflows/ci.yml";
    private const string WeeklyPath = ".github/workflows/weekly.yml";
    private const string DeployPath = ".github/workflows/deploy.yml";

    // Owner-approved actions (plan 03-01 Task 1, 2026-10-15): "owner/repo@commit" to its version comment.
    private static readonly Dictionary<string, string> ApprovedActions = new(StringComparer.Ordinal)
    {
        ["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"] = "v7.0.1",
        ["actions/setup-dotnet@a98b56852c35b8e3190ac28c8c2271da59106c68"] = "v6.0.0",
        ["actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"] = "v7.0.0",
        ["actions/cache@55cc8345863c7cc4c66a329aec7e433d2d1c52a9"] = "v6.1.0",
        ["actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a"] = "v7.0.1",
        ["zizmorcore/zizmor-action@cc914d7f3750a2d13d75c7f184a1060aa0e9d482"] = "v0.6.4",
    };

    private static readonly string[] PinnedRunners = ["ubuntu-24.04", "windows-2025"];

    // OPS-02 order of every step in the gate job (stage digit first, then the step).
    private static readonly string[] RequiredGateSteps =
    [
        "1 restore (locked)",
        "1 npm ci",
        "1 audits",
        "2 build",
        "2 format check",
        "3 unit tests",
        "3 integration tests",
        "3 architecture tests",
        "4 web typecheck",
        "4 web lint",
        "4 web prettier",
        "4 web vitest + coverage",
        "4 openapi types check",
        "5 web build",
        "5 web budget build",
        "5 sql container",
        "5 test secrets",
        "5 playwright browsers",
        "5 playwright browsers all engines",
        "5 playwright",
        "5 playwright all engines",
        "5 lighthouse",
        "6 coverage gate",
        "6 web licenses",
        "6 web notices",
        "6 nuget licenses + notices",
    ];

    // Each detector is paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] RunSinkDetectors =
    [
        (EventExpression(), "echo ${{ github.event.pull_request.title }}"),
        (InputsExpression(), "echo ${{ inputs.target }}"),
        (HeadRefExpression(), "git checkout ${{ github.head_ref }}"),
    ];

    [Fact]
    public void WorkflowFilesExistAndAreAllYml()
    {
        WorkflowText.Files().ShouldContain(CiPath, "ci.yml is the OPS-02 gate and must exist.");
        WorkflowText.UnreadFiles().ShouldBeEmpty("Use the .yml extension only; these tests read no other workflow file.");
    }

    [Fact]
    public void EveryUsesIsAnApprovedShaPin()
    {
        WorkflowText.Files().ShouldNotBeEmpty();

        var offenders = WorkflowText.Files()
            .SelectMany(path => WorkflowText.UsesValues(WorkflowText.Lines(path))
                .Where(value => !IsApprovedPin(value))
                .Select(value => $"{path}: {value}"))
            .ToList();

        offenders.ShouldBeEmpty("Every uses: must be a local workflow or an owner-approved owner/repo@<40-hex sha> # vX.Y.Z (T-03-01).");
    }

    [Fact]
    public void PinDetectorCatchesLooseAndUnapprovedReferences()
    {
        IsApprovedPin("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1").ShouldBeTrue();
        IsApprovedPin("./.github/workflows/reusable.yml").ShouldBeTrue();

        IsApprovedPin("actions/checkout@v7").ShouldBeFalse();
        IsApprovedPin("actions/checkout@main").ShouldBeFalse();
        IsApprovedPin("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1").ShouldBeFalse();
        IsApprovedPin("actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.2").ShouldBeFalse();
        IsApprovedPin("actions/checkout@3D3C42E5AAC5BA805825DA76410C181273BA90B1 # v7.0.1").ShouldBeFalse();
        IsApprovedPin("evil/action@0123456789abcdef0123456789abcdef01234567 # v1.0.0").ShouldBeFalse();
        IsApprovedPin("docker://alpine:3.20").ShouldBeFalse();
    }

    [Fact]
    public void TopLevelPermissionsAreEmpty()
    {
        WorkflowText.Files().ShouldNotBeEmpty();

        var offenders = WorkflowText.Files()
            .Where(path => !WorkflowText.Lines(path).Any(line => line.TrimEnd() == "permissions: {}"))
            .ToList();

        offenders.ShouldBeEmpty("Every workflow starts from no token permissions: top-level permissions: {} (T-03-02).");
    }

    [Fact]
    public void NoWorkflowGrantsBroadPermissions()
    {
        var offenders = WorkflowText.Files()
            .SelectMany(path => WorkflowText.Lines(path)
                .Where(line => BroadPermission().IsMatch(line))
                .Select(line => $"{path}: {line.Trim()}"))
            .ToList();

        offenders.ShouldBeEmpty("read-all and write-all are not allowed; name the single scope a job needs (T-03-02).");
    }

    [Fact]
    public void CiJobsNeverGrantWrite()
    {
        var jobs = WorkflowText.Jobs(WorkflowText.Lines(CiPath));
        jobs.ShouldNotBeEmpty();

        var offenders = jobs
            .SelectMany(job => WorkflowText.Section(job.Lines, "permissions")
                .Where(line => line.TrimEnd().EndsWith(": write", StringComparison.Ordinal))
                .Select(line => $"{job.Id}: {line.Trim()}"))
            .ToList();

        offenders.ShouldBeEmpty("CI only reads the repository (T-03-02).");
    }

    [Fact]
    public void EveryJobHasATimeout()
    {
        WorkflowText.Files().ShouldNotBeEmpty();

        var offenders = WorkflowText.Files()
            .SelectMany(path => WorkflowText.Jobs(WorkflowText.Lines(path))
                .Where(job => !job.Lines.Any(line => JobUses().IsMatch(line)))
                .Where(job => !job.Lines.Any(line => JobTimeout().IsMatch(line)))
                .Select(job => $"{path}: {job.Id}"))
            .ToList();

        offenders.ShouldBeEmpty("Every job sets timeout-minutes so a hang cannot burn the free minutes (T-03-06).");
    }

    [Fact]
    public void CheckoutNeverPersistsCredentials()
    {
        var checkouts = WorkflowText.Files()
            .SelectMany(path => WorkflowText.Jobs(WorkflowText.Lines(path))
                .SelectMany(job => WorkflowText.Steps(job.Lines).Select(step => (Location: $"{path}: {job.Id}", Step: step))))
            .Where(item => item.Step.Any(line => UsesKey().IsMatch(line) && line.Contains("actions/checkout@", StringComparison.Ordinal)))
            .ToList();

        checkouts.ShouldNotBeEmpty();

        var offenders = checkouts
            .Where(item => !item.Step.Any(line => line.Trim() == "persist-credentials: false"))
            .Select(item => item.Location)
            .ToList();

        offenders.ShouldBeEmpty("Every actions/checkout sets persist-credentials: false (T-03-03).");
    }

    [Fact]
    public void RunnersArePinned()
    {
        var runners = WorkflowText.Files()
            .SelectMany(path => WorkflowText.Lines(path)
                .Select(line => RunsOn().Match(line))
                .Where(match => match.Success)
                .Select(match => (Path: path, Runner: match.Groups["runner"].Value)))
            .ToList();

        runners.ShouldNotBeEmpty();

        var offenders = runners
            .Where(item => !PinnedRunners.Contains(item.Runner, StringComparer.Ordinal))
            .Select(item => $"{item.Path}: {item.Runner}")
            .ToList();

        offenders.ShouldBeEmpty("Runner labels are ubuntu-24.04 or windows-2025, never a moving label.");
    }

    [Fact]
    public void NoWorkflowUsesPullRequestTarget()
    {
        WorkflowText.Files().ShouldNotBeEmpty();

        var offenders = WorkflowText.Files()
            .Where(path => WorkflowText.Lines(path).Any(line => PullRequestTarget().IsMatch(line)))
            .ToList();

        offenders.ShouldBeEmpty("pull_request_target would run PR code with secrets (T-03-05).");
        PullRequestTarget().IsMatch("  pull_request_target:").ShouldBeTrue();
    }

    [Fact]
    public void RunDetectorsCatchTheirSamples()
    {
        foreach (var (pattern, sample) in RunSinkDetectors)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"The detector {pattern} must catch: {sample}");
        }
    }

    [Fact]
    public void NoExpressionSinkInRun()
    {
        WorkflowText.Files().ShouldNotBeEmpty();

        var offenders = WorkflowText.Files()
            .SelectMany(path => WorkflowText.RunBlocks(WorkflowText.Lines(path))
                .Where(block => RunSinkDetectors.Any(detector => detector.Pattern.IsMatch(block)))
                .Select(block => $"{path}: {block}"))
            .ToList();

        offenders.ShouldBeEmpty("Event data reaches scripts through env: only, never inside run: (CWE-77, T-03-04).");
    }

    [Fact]
    public void CiTriggersAndConcurrency()
    {
        var lines = WorkflowText.Lines(CiPath);
        var triggers = WorkflowText.Section(lines, "on");
        var pullRequest = WorkflowText.Section(triggers, "pull_request").Select(line => line.Trim()).ToList();
        var push = WorkflowText.Section(triggers, "push").Select(line => line.Trim()).ToList();

        pullRequest.ShouldContain("branches: [main]");
        pullRequest.ShouldContain("types: [opened, synchronize, reopened, ready_for_review]");
        push.ShouldContain("branches: [main]");
        triggers.Any(line => line.TrimEnd() == "  workflow_dispatch:").ShouldBeTrue("ci.yml needs workflow_dispatch.");
        triggers.Any(line => PathFilter().IsMatch(line)).ShouldBeFalse("A path filter would skip the workflow and report no check.");

        var concurrency = WorkflowText.Section(lines, "concurrency").Select(line => line.Trim()).ToList();
        concurrency.ShouldContain("group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.sha }}");
        concurrency.ShouldContain("cancel-in-progress: ${{ github.event_name == 'pull_request' }}");
    }

    [Fact]
    public void GateCheckNameCarriesTheMode()
    {
        var gate = GateJob();

        gate.Lines.Select(line => line.Trim()).ShouldContain("name: gate (${{ needs.classify.outputs.mode }})");
        gate.Lines.Select(line => line.Trim()).ShouldContain("needs: classify");
        gate.Lines.Select(line => line.Trim()).ShouldContain("runs-on: ubuntu-24.04");
    }

    [Fact]
    public void GateStepsFollowOpsOrder()
    {
        var names = WorkflowText.StepNames(GateJob().Lines);

        var stages = names
            .Select(name => StageDigit().Match(name))
            .Where(match => match.Success)
            .Select(match => int.Parse(match.Groups["stage"].Value, System.Globalization.CultureInfo.InvariantCulture))
            .ToList();
        stages.ShouldBe([.. stages.Order()], "Stage digits in step names must never decrease.");

        var positions = RequiredGateSteps.Select(name => names.ToList().IndexOf(name)).ToList();
        positions.ShouldAllBe(position => position >= 0, "A required gate step is missing from the gate job.");
        positions.ShouldBe([.. positions.Order()], "The gate steps must run in the OPS-02 order.");
    }

    [Fact]
    public void IntegrationTestsRunOnlyInFullModeAgainstTheContainer()
    {
        var step = WorkflowText.Steps(GateJob().Lines)
            .Single(candidate => WorkflowText.StepName(candidate) == "3 integration tests")
            .Select(line => line.Trim())
            .ToList();

        step.ShouldContain("if: needs.classify.outputs.mode == 'full'");
        step.ShouldContain("CSPS_TEST_SQL: container");
    }

    [Fact]
    public void ContainerImageMatchesTheFixture()
    {
        var fixture = ContainerImageLiteral().Match(File.ReadAllText(RepoRoot.PathOf("tests/Csps.Testing/SqlServerInstance.cs")));
        fixture.Success.ShouldBeTrue("SqlServerInstance.ContainerImage literal not found.");

        var offenders = WorkflowText.Files()
            .SelectMany(path => WorkflowText.Lines(path)
                .SelectMany(line => SqlImage().Matches(line).Select(match => match.Value))
                .Where(image => !string.Equals(image, fixture.Groups["image"].Value, StringComparison.Ordinal))
                .Select(image => $"{path}: {image}"))
            .ToList();

        offenders.ShouldBeEmpty("A workflow must use the same SQL Server image as the test fixture.");
    }

    [Fact]
    public void ClassifyUsesTheTestedScript()
    {
        var classify = JobById("classify");

        WorkflowText.Section(classify.Lines, "permissions").Select(line => line.Trim()).Order(StringComparer.Ordinal).ToList()
            .ShouldBe(["checks: read", "contents: read", "pull-requests: read"], customMessage: "classify reads the repository, pull requests and checks only (T-03-02).");

        var steps = WorkflowText.Steps(classify.Lines);

        var checkout = steps.Single(step => step.Any(line => line.Contains("actions/checkout@", StringComparison.Ordinal)))
            .Select(line => line.Trim()).ToList();
        checkout.ShouldContain("persist-credentials: false");
        checkout.ShouldContain("fetch-depth: 0", "The docs/fast diff and the proven-tree lookup need the full history.");

        steps.Single(step => step.Any(line => line.Contains("actions/setup-node@", StringComparison.Ordinal)))
            .Select(line => line.Trim()).ShouldContain("node-version: \"24.21.0\"");

        var script = steps.Single(step => step.Any(line => line.Trim() == "run: node web/scripts/ci-classify.mjs"))
            .Select(line => line.Trim()).ToList();
        foreach (var key in new[] { "GITHUB_EVENT_NAME", "PR_DRAFT", "BASE_SHA", "HEAD_SHA", "GH_TOKEN" })
        {
            script.ShouldContain(line => line.StartsWith(key + ": ${{ ", StringComparison.Ordinal), $"{key} must reach the classifier through env: (T-03-04).");
        }

        classify.Lines.Select(line => line.Trim()).ShouldContain("timeout-minutes: 5");
    }

    [Fact]
    public void GateSetsUpNodeWithAnNpmCache()
    {
        var node = WorkflowText.Steps(GateJob().Lines)
            .Single(step => step.Any(line => line.Contains("actions/setup-node@", StringComparison.Ordinal)))
            .Select(line => line.Trim()).ToList();

        node.ShouldContain("node-version: \"24.21.0\"");
        node.ShouldContain("cache: npm");
        node.ShouldContain("web/package-lock.json");
        node.ShouldContain("tools/openapi-gen/package-lock.json");
    }

    [Fact]
    public void WebStageIsInTheFastPart()
    {
        var names = WorkflowText.StepNames(GateJob().Lines).ToList();
        string[] order =
        [
            "1 restore (locked)",
            "1 npm ci",
            "1 audits",
            "2 build",
            "3 architecture tests",
            "4 web typecheck",
            "4 web lint",
            "4 web prettier",
            "4 web vitest + coverage",
            "4 openapi types check",
        ];
        var positions = order.Select(name => names.IndexOf(name)).ToList();
        positions.ShouldAllBe(position => position >= 0, "A web stage step is missing from the gate job.");
        positions.ShouldBe([.. positions.Order()], "The web stage steps must follow the OPS-02 order.");

        StepText("1 npm ci").ShouldContain("npm ci --prefix web");
        StepText("1 npm ci").ShouldContain("npm ci --prefix tools/openapi-gen");
        StepText("4 web typecheck").ShouldContain("npm --prefix web run typecheck");
        StepText("4 web lint").ShouldContain("npm --prefix web run lint");
        StepText("4 web prettier").ShouldContain("npm --prefix web run format:check");
        StepText("4 web vitest + coverage").ShouldContain("npm --prefix web run test:coverage");
        StepText("4 openapi types check").ShouldContain("npm --prefix tools/openapi-gen run check");
        StepText("4 openapi types check").ShouldContain("npm --prefix tools/openapi-gen test");

        foreach (var name in order.Where(name => name[0] is '1' or '4'))
        {
            StepLines(name).ShouldNotContain(line => line.StartsWith("if:", StringComparison.Ordinal), $"{name} belongs to the fast part and has no mode condition.");
        }
    }

    [Fact]
    public void AuditsComeBeforeBuild()
    {
        var names = WorkflowText.StepNames(GateJob().Lines).ToList();
        names.IndexOf("1 audits").ShouldBeGreaterThanOrEqualTo(0);
        names.IndexOf("1 audits").ShouldBeLessThan(names.IndexOf("2 build"));

        StepText("1 audits").ShouldContain("npm --prefix web audit --audit-level=low");
        StepText("1 audits").ShouldContain("npm --prefix tools/openapi-gen audit --audit-level=low");
    }

    [Fact]
    public void GateRunsTheWholeOpsOrder()
    {
        var names = WorkflowText.StepNames(GateJob().Lines).ToList();

        RequiredGateSteps.ShouldAllBe(name => names.Contains(name), "Every OPS-02 step must be in the gate job.");

        var stages = names
            .Select(name => StageDigit().Match(name))
            .Where(match => match.Success)
            .Select(match => int.Parse(match.Groups["stage"].Value, System.Globalization.CultureInfo.InvariantCulture))
            .ToList();
        stages.Distinct().Order().ToList().ShouldBe([1, 2, 3, 4, 5, 6]);
        stages.ShouldBe([.. stages.Order()], "Stage digits in step names must never decrease.");
    }

    [Fact]
    public void WebScriptsKeepVerifyOrder()
    {
        var verify = File.ReadAllText(RepoRoot.PathOf("web/scripts/verify.mjs"));
        var stepsBlock = VerifySteps().Match(verify);
        stepsBlock.Success.ShouldBeTrue("The STEPS array was not found in web/scripts/verify.mjs.");
        var verifySteps = Regex.Matches(stepsBlock.Groups["steps"].Value, "'(?<script>[^']+)'")
            .Select(match => match.Groups["script"].Value)
            .ToList();
        verifySteps.ShouldNotBeEmpty();

        var called = WorkflowText.Steps(GateJob().Lines)
            .SelectMany(step => WorkflowText.RunBlocks(step))
            .SelectMany(block => WebScript().Matches(block).Select(match => match.Groups["script"].Value))
            .Where(verifySteps.Contains)
            .ToList();

        called.ShouldBe(verifySteps, customMessage: "The gate runs the web scripts in the order of verify.mjs STEPS, each once.");
    }

    [Fact]
    public void E2eUsesChromiumAndPhone()
    {
        StepLines("5 playwright").ShouldContain(line => line.StartsWith("if:", StringComparison.Ordinal)
            && line.Contains("needs.classify.outputs.mode == 'full'", StringComparison.Ordinal)
            && line.Contains("!inputs.all-engines", StringComparison.Ordinal));
        StepText("5 playwright").ShouldContain("npm --prefix web run e2e -- --project chromium --project pixel");
        StepText("5 playwright").ShouldContain("CSPS_E2E_CONNECTION=");

        StepLines("5 playwright all engines").ShouldContain(line => line.StartsWith("if:", StringComparison.Ordinal)
            && line.Contains("needs.classify.outputs.mode == 'full'", StringComparison.Ordinal)
            && line.Contains("&& inputs.all-engines", StringComparison.Ordinal));
        StepText("5 playwright all engines").ShouldContain("npm --prefix web run e2e");
        StepText("5 playwright all engines").ShouldNotContain("--project");
        StepText("5 playwright all engines").ShouldContain("CSPS_E2E_CONNECTION=");
    }

    [Fact]
    public void ContainerIsLoopbackAndSecretIsGenerated()
    {
        var fixture = ContainerImageLiteral().Match(File.ReadAllText(RepoRoot.PathOf("tests/Csps.Testing/SqlServerInstance.cs")));
        fixture.Success.ShouldBeTrue();

        var container = StepText("5 sql container");
        container.ShouldContain("docker run");
        container.ShouldContain("127.0.0.1:1433:1433");
        container.ShouldContain(fixture.Groups["image"].Value);
        container.ShouldContain("openssl rand");
        container.ShouldContain("::add-mask::");
        container.ShouldContain("-e MSSQL_SA_PASSWORD ");
        container.ShouldContain("ACCEPT_EULA=Y");

        foreach (var path in WorkflowText.Files())
        {
            var lines = WorkflowText.Lines(path);
            lines.ShouldNotContain(line => PublishedPort().IsMatch(line), $"{path}: a published container port must bind 127.0.0.1 (T-03-41).");
            lines.ShouldNotContain(line => LiteralPassword().IsMatch(line), $"{path}: no literal password; it is generated in the run (T-03-41).");
        }

        LiteralPassword().IsMatch("MSSQL_SA_PASSWORD=hunter2").ShouldBeTrue();
        LiteralPassword().IsMatch("User Id=sa;Password=hunter2;").ShouldBeTrue();
        LiteralPassword().IsMatch("Password=${SQL_SA_PASSWORD};").ShouldBeFalse();
        PublishedPort().IsMatch("-p 1433:1433").ShouldBeTrue();
        PublishedPort().IsMatch("-p 127.0.0.1:1433:1433").ShouldBeFalse();
    }

    [Fact]
    public void HeavyStepsRunOnlyInFullMode()
    {
        var heavy = WorkflowText.Steps(GateJob().Lines)
            .Where(step => WorkflowText.StepName(step) is { } name
                && (name.StartsWith("5 ", StringComparison.Ordinal) || name.StartsWith("6 ", StringComparison.Ordinal)))
            .ToList();
        heavy.ShouldNotBeEmpty();

        var offenders = heavy
            .Where(step => !step.Any(line => line.Trim().StartsWith("if:", StringComparison.Ordinal)
                && line.Contains("needs.classify.outputs.mode == 'full'", StringComparison.Ordinal)))
            .Select(WorkflowText.StepName)
            .ToList();

        offenders.ShouldBeEmpty("Stage 5 and 6 steps run only in full mode (D-14).");
    }

    [Fact]
    public void FailureReportsAreUploadedForSevenDaysOnly()
    {
        var upload = WorkflowText.Steps(GateJob().Lines)
            .Single(step => step.Any(line => line.Contains("actions/upload-artifact@", StringComparison.Ordinal)))
            .Select(line => line.Trim())
            .ToList();

        upload.ShouldContain(line => line.StartsWith("if: failure()", StringComparison.Ordinal));
        upload.ShouldContain("retention-days: 7");
        upload.ShouldContain("web/playwright-report");
        upload.ShouldContain("web/test-results");
        upload.ShouldNotContain(line => line.Contains("secrets", StringComparison.OrdinalIgnoreCase), "User-secrets are never uploaded (T-03-42).");
    }

    [Fact]
    public void NoWorkflowCarriesAProductionSecret()
    {
        // deploy.yml is the one workflow that holds the deploy credentials; DeployWorkflowTests pins how it uses them.
        var offenders = WorkflowText.Files()
            .Where(path => path != DeployPath)
            .SelectMany(path => WorkflowText.Lines(path)
                .Where(line => ProductionSecret().IsMatch(line))
                .Select(line => $"{path}: {line.Trim()}"))
            .ToList();

        offenders.ShouldBeEmpty("CI uses only its own loopback container and holds no production secret or deploy credential (T-03-43).");
        WorkflowText.Files().ShouldContain(DeployPath, "The exemption above names the deploy workflow, which must exist.");
    }

    [Fact]
    public void WeeklyRunsAllEngines()
    {
        var lines = WorkflowText.Lines(WeeklyPath);
        lines.ShouldNotBeEmpty("weekly.yml is the D-15 all-engine run.");

        var triggers = WorkflowText.Section(lines, "on").Select(line => line.Trim()).ToList();
        triggers.ShouldContain("- cron: \"0 18 * * 0\"");
        triggers.ShouldContain("workflow_dispatch:");
        triggers.ShouldNotContain(line => line.StartsWith("pull_request", StringComparison.Ordinal) || line.StartsWith("push", StringComparison.Ordinal));

        var jobs = WorkflowText.Jobs(lines);
        jobs.Count.ShouldBe(1);

        var job = jobs[0].Lines.Select(line => line.Trim()).ToList();
        job.ShouldContain("uses: ./.github/workflows/ci.yml");
        WorkflowText.Section(jobs[0].Lines, "with").Select(line => line.Trim()).ShouldBe(["all-engines: true"], customMessage: "The weekly run passes all-engines and nothing else.");
        WorkflowText.Section(jobs[0].Lines, "permissions").Select(line => line.Trim()).Order(StringComparer.Ordinal).ToList()
            .ShouldBe(["checks: read", "contents: read", "pull-requests: read"], customMessage: "The caller grants what ci.yml's jobs ask for, and no more.");
    }

    [Fact]
    public void CiAcceptsWorkflowCall()
    {
        var lines = WorkflowText.Lines(CiPath);
        var triggers = WorkflowText.Section(lines, "on");
        var call = WorkflowText.Section(triggers, "workflow_call").Select(line => line.Trim()).ToList();

        call.ShouldContain("all-engines:");
        call.ShouldContain("type: boolean");
        call.ShouldContain("default: false");

        var offenders = lines
            .Where(line => line.Contains("inputs.all-engines", StringComparison.Ordinal))
            .Where(line => !line.Trim().StartsWith("if:", StringComparison.Ordinal))
            .Select(line => line.Trim())
            .ToList();
        offenders.ShouldBeEmpty("inputs.all-engines is read only in if: conditions, never in a script (CWE-77).");
        lines.ShouldContain(line => line.Contains("inputs.all-engines", StringComparison.Ordinal));
    }

    private static WorkflowJob JobById(string id)
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(CiPath)).SingleOrDefault(candidate => candidate.Id == id);
        job.ShouldNotBeNull($"ci.yml needs a job with the id {id}.");
        return job;
    }

    private static List<string> StepLines(string name) =>
        WorkflowText.Steps(GateJob().Lines)
            .Single(step => WorkflowText.StepName(step) == name)
            .Select(line => line.Trim())
            .ToList();

    private static string StepText(string name) => string.Join('\n', StepLines(name));

    private static WorkflowJob GateJob()
    {
        var gate = WorkflowText.Jobs(WorkflowText.Lines(CiPath)).SingleOrDefault(job => job.Id == "gate");
        gate.ShouldNotBeNull("ci.yml needs a job with the id gate.");
        return gate;
    }

    private static bool IsApprovedPin(string value)
    {
        if (LocalWorkflow().IsMatch(value))
        {
            return true;
        }

        var match = ShaPin().Match(value);
        return match.Success
            && ApprovedActions.TryGetValue(match.Groups["pin"].Value, out var version)
            && string.Equals(version, match.Groups["version"].Value, StringComparison.Ordinal);
    }

    [GeneratedRegex(@"^\./\.github/workflows/[A-Za-z0-9._-]+\.yml$", RegexOptions.CultureInvariant)]
    private static partial Regex LocalWorkflow();

    [GeneratedRegex(@"^(?<pin>[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+@[0-9a-f]{40}) # (?<version>v\d+\.\d+\.\d+)$", RegexOptions.CultureInvariant)]
    private static partial Regex ShaPin();

    [GeneratedRegex(@"\b(?:read-all|write-all)\b", RegexOptions.CultureInvariant)]
    private static partial Regex BroadPermission();

    [GeneratedRegex(@"^    timeout-minutes: \d+\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex JobTimeout();

    [GeneratedRegex(@"^    uses:", RegexOptions.CultureInvariant)]
    private static partial Regex JobUses();

    [GeneratedRegex(@"^\s*(?:- )?uses:", RegexOptions.CultureInvariant)]
    private static partial Regex UsesKey();

    [GeneratedRegex(@"^\s*runs-on:\s*(?<runner>\S.*?)\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex RunsOn();

    [GeneratedRegex(@"^[^#]*\bpull_request_target\b", RegexOptions.CultureInvariant)]
    private static partial Regex PullRequestTarget();

    [GeneratedRegex(@"\$\{\{\s*github\.event\b", RegexOptions.CultureInvariant)]
    private static partial Regex EventExpression();

    [GeneratedRegex(@"\$\{\{\s*inputs\.", RegexOptions.CultureInvariant)]
    private static partial Regex InputsExpression();

    [GeneratedRegex(@"\$\{\{\s*github\.head_ref\b", RegexOptions.CultureInvariant)]
    private static partial Regex HeadRefExpression();

    [GeneratedRegex(@"^\s*paths(?:-ignore)?\s*:", RegexOptions.CultureInvariant)]
    private static partial Regex PathFilter();

    [GeneratedRegex(@"STEPS\s*=\s*Object\.freeze\(\[(?<steps>[^\]]*)\]", RegexOptions.CultureInvariant)]
    private static partial Regex VerifySteps();

    [GeneratedRegex(@"npm --prefix web run (?<script>[A-Za-z0-9:_-]+)", RegexOptions.CultureInvariant)]
    private static partial Regex WebScript();

    [GeneratedRegex(@"(?:^|\s)-p\s+(?!127\.0\.0\.1:)\S*\d+:\d+", RegexOptions.CultureInvariant)]
    private static partial Regex PublishedPort();

    [GeneratedRegex(@"(?:MSSQL_SA_PASSWORD|\bPassword)=(?!\$|""\$)\S", RegexOptions.CultureInvariant)]
    private static partial Regex LiteralPassword();

    [GeneratedRegex(@"\$\{\{\s*secrets\.(?!GITHUB_TOKEN\b)|\b(?:MSDEPLOY|WEBDEPLOY|PRODUCTION)_\w*(?:SECRET|PASSWORD|TOKEN)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ProductionSecret();

    [GeneratedRegex(@"^(?<stage>[1-7]) ", RegexOptions.CultureInvariant)]
    private static partial Regex StageDigit();

    [GeneratedRegex("ContainerImage\\s*=\\s*\"(?<image>[^\"]+)\"", RegexOptions.CultureInvariant)]
    private static partial Regex ContainerImageLiteral();

    [GeneratedRegex(@"mcr\.microsoft\.com/mssql/server:[^\s""']+", RegexOptions.CultureInvariant)]
    private static partial Regex SqlImage();
}
