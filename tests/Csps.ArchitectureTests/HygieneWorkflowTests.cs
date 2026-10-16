using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// OPS-03 / D-10 rules for the secret scan: a checksum-verified gitleaks in CI and on the developer machine, a narrow
/// allowlist, and the pre-commit hook (threats T-03-19 to T-03-22).
/// </summary>
public sealed partial class HygieneWorkflowTests
{
    private const string HygienePath = ".github/workflows/hygiene.yml";
    private const string InstallerPath = "tools/scripts/Install-Gitleaks.ps1";
    private const string ConfigPath = ".gitleaks.toml";
    private const string HookPath = ".githooks/pre-commit";
    private const string AttributesPath = ".gitattributes";

    // Research "Supporting (CLI tools)" table, owner-approved in plan 03-01 Task 1.
    private const string Version = "8.30.1";
    private const string LinuxSha256 = "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb";
    private const string WindowsSha256 = "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e";
    private const string LinuxAsset = "gitleaks_8.30.1_linux_x64.tar.gz";

    // Owner-approved in plan 03-01 Task 1: actionlint 1.7.12 (linux tarball) and zizmor-action v0.6.4 (runs zizmor 1.30.1).
    private const string ActionlintAsset = "actionlint_1.7.12_linux_amd64.tar.gz";
    private const string ActionlintLinuxSha256 = "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8";
    private const string ZizmorActionCommit = "cc914d7f3750a2d13d75c7f184a1060aa0e9d482";

    // Patterns that would silence the scan for everything; the detector must catch each one.
    private static readonly string[] BroadSamples = ["", ".*", ".+", "^", "$", "^.*$", "^.+$", "(?s).*", "(?s).+", "[\\s\\S]*"];

    [Fact]
    public void CiScanIsPinnedAndChecked()
    {
        var text = WorkflowText.Lines(HygienePath).ToList();
        text.ShouldNotBeEmpty($"{HygienePath} must exist.");

        var joined = string.Join('\n', text);
        joined.ShouldContain(LinuxAsset);
        joined.ShouldContain($"{LinuxSha256}  {LinuxAsset}");

        var checkLine = text.FindIndex(line => line.Contains("sha256sum -c", StringComparison.Ordinal));
        var extractLine = text.FindIndex(line => ExtractCommand().IsMatch(line));
        checkLine.ShouldBeGreaterThanOrEqualTo(0, "The download must be checked with sha256sum -c.");
        extractLine.ShouldBeGreaterThan(checkLine, "The archive is extracted only after the checksum passed.");

        var scan = text.Where(line => line.Contains("gitleaks git", StringComparison.Ordinal)).ToList();
        scan.ShouldNotBeEmpty("The job must run gitleaks git.");
        joined.ShouldContain("--config .gitleaks.toml");
        joined.ShouldContain("--redact");
        joined.ShouldContain("--log-opts");
    }

    [Fact]
    public void LocalInstallerMatchesCi()
    {
        var text = string.Join('\n', WorkflowText.Lines(InstallerPath));
        text.ShouldNotBeEmpty($"{InstallerPath} must exist.");

        text.ShouldContain(Version);
        text.ShouldContain(WindowsSha256);
        text.ShouldContain("gitleaks_8.30.1_windows_x64.zip");
        text.ShouldContain("Get-FileHash");
        text.ShouldContain("-SetHooksPath");
        text.ShouldContain("config --local core.hooksPath");

        text.IndexOf("Get-FileHash", StringComparison.Ordinal)
            .ShouldBeLessThan(text.IndexOf("Expand-Archive", StringComparison.Ordinal), "The hash is checked before the zip is extracted.");

        text.ShouldNotContain("SetEnvironmentVariable", Case.Insensitive, "The installer never writes User or Machine settings.");
        text.ShouldNotContain("--global", Case.Insensitive);
        text.ShouldNotContain("--system", Case.Insensitive);
    }

    [Fact]
    public void AllowlistsAreNarrow()
    {
        var lines = WorkflowText.Lines(ConfigPath).ToList();
        lines.ShouldNotBeEmpty($"{ConfigPath} must exist.");
        lines.ShouldContain(line => line.Trim() == "useDefault = true");

        foreach (var sample in BroadSamples)
        {
            IsBroad(sample).ShouldBeTrue($"The broad-pattern detector must catch: {sample}");
        }

        IsBroad("^tests/Csps\\.ArchitectureTests/HostingRecordTests\\.cs$").ShouldBeFalse();

        var entries = AllowlistBlocks(lines);
        foreach (var entry in entries)
        {
            var label = entry.FirstOrDefault(line => line.TrimStart().StartsWith("description", StringComparison.Ordinal)) ?? "(no description)";
            DescriptionValue().IsMatch(string.Join('\n', entry)).ShouldBeTrue($"Every allowlist entry needs a description: {label}");

            var paths = Values(entry, "paths");
            var regexes = Values(entry, "regexes");
            paths.ShouldNotBeEmpty($"Every allowlist entry lists explicit file paths: {label}");

            foreach (var path in paths)
            {
                IsExplicitFile(path).ShouldBeTrue($"An allowlist path must name one file exactly: {path}");
            }

            foreach (var value in paths.Concat(regexes))
            {
                IsBroad(value).ShouldBeFalse($"An allowlist pattern must not match everything: {value}");
            }
        }
    }

    [Fact]
    public void HygieneTriggers()
    {
        var lines = WorkflowText.Lines(HygienePath);
        lines.ShouldNotBeEmpty($"{HygienePath} must exist.");

        lines.ShouldContain(line => line.TrimEnd() == "name: Hygiene");

        var triggers = WorkflowText.Section(lines, "on");
        var pullRequest = WorkflowText.Section(triggers, "pull_request").Select(line => line.Trim()).ToList();
        var push = WorkflowText.Section(triggers, "push").Select(line => line.Trim()).ToList();
        pullRequest.ShouldContain("branches: [main]");
        pullRequest.ShouldContain("types: [opened, synchronize, reopened, ready_for_review, edited]");
        push.ShouldContain("branches: [main]");

        var concurrency = WorkflowText.Section(lines, "concurrency").Select(line => line.Trim()).ToList();
        concurrency.ShouldContain(line => line.StartsWith("group:", StringComparison.Ordinal)
            && line.Contains("github.event.pull_request.number || github.sha", StringComparison.Ordinal));

        var job = WorkflowText.Jobs(lines).SingleOrDefault(candidate => candidate.Id == "secrets");
        job.ShouldNotBeNull("hygiene.yml needs a job with the id secrets.");
        var jobLines = job.Lines.Select(line => line.Trim()).ToList();
        jobLines.ShouldContain("name: secret scan");
        jobLines.ShouldContain(line => TimeoutLine().IsMatch(line));
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).ShouldBe(["contents: read"]);
    }

    [Fact]
    public void CommitMessagesJob()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(HygienePath)).SingleOrDefault(candidate => candidate.Id == "commits");
        job.ShouldNotBeNull("hygiene.yml needs a job with the id commits (OPS-01).");
        var jobLines = job.Lines.Select(line => line.Trim()).ToList();

        jobLines.ShouldContain("name: commit messages");
        jobLines.ShouldContain("runs-on: ubuntu-24.04");
        jobLines.ShouldContain("timeout-minutes: 5");
        jobLines.ShouldContain("if: github.event_name == 'pull_request'", "The check needs a PR title, so it runs for pull requests only.");
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).ShouldBe(["contents: read"]);

        var steps = WorkflowText.Steps(job.Lines);
        var checkout = steps.Single(step => WorkflowText.StepName(step) == "checkout").Select(line => line.Trim()).ToList();
        checkout.ShouldContain("fetch-depth: 0");
        checkout.ShouldContain("persist-credentials: false");

        var node = steps.Single(step => WorkflowText.StepName(step) == "setup node").Select(line => line.Trim()).ToList();
        node.ShouldContain("node-version: \"24.21.0\"");

        // T-03-24 (CWE-77): the PR title and the commit range reach the script through env, never inside run.
        var lint = steps.Single(step => step.Any(line => line.Contains("commit-lint.mjs", StringComparison.Ordinal))).Select(line => line.Trim()).ToList();
        lint.ShouldContain("run: node web/scripts/commit-lint.mjs");
        lint.ShouldContain("PR_TITLE: ${{ github.event.pull_request.title }}");
        lint.ShouldContain("BASE_SHA: ${{ github.event.pull_request.base.sha }}");
        lint.ShouldContain("HEAD_SHA: ${{ github.event.pull_request.head.sha }}");
        WorkflowText.RunBlocks(jobLines).ShouldAllBe(block => !block.Contains("${{", StringComparison.Ordinal));
    }

    // OPS-02 / T-03-23, T-03-SC: actionlint is approved (plan 03-01 Task 1, reply approve-all), so it must be checksum-pinned.
    [Fact]
    public void ActionlintIsPinned()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(HygienePath)).SingleOrDefault(candidate => candidate.Id == "actionlint");
        job.ShouldNotBeNull("hygiene.yml needs a job with the id actionlint (OPS-02).");
        var jobLines = job.Lines.Select(line => line.Trim()).ToList();

        jobLines.ShouldContain("name: actionlint");
        jobLines.ShouldContain("runs-on: ubuntu-24.04");
        jobLines.ShouldContain("timeout-minutes: 10");
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).ShouldBe(["contents: read"]);

        var checkout = WorkflowText.Steps(job.Lines).Single(step => WorkflowText.StepName(step) == "checkout").Select(line => line.Trim()).ToList();
        checkout.ShouldContain("persist-credentials: false");

        var text = string.Join('\n', WorkflowText.RunBlocks(job.Lines).SelectMany(block => block.Split('\n')));
        text.ShouldContain(ActionlintAsset);
        text.ShouldContain($"{ActionlintLinuxSha256}  {ActionlintAsset}");

        var lines = text.Split('\n').ToList();
        var checkLine = lines.FindIndex(line => line.Contains("sha256sum -c", StringComparison.Ordinal));
        var extractLine = lines.FindIndex(line => ExtractCommand().IsMatch(line));
        checkLine.ShouldBeGreaterThanOrEqualTo(0, "The download must be checked with sha256sum -c.");
        extractLine.ShouldBeGreaterThan(checkLine, "The archive is extracted only after the checksum passed.");
        lines.ShouldContain(line => line.StartsWith("actionlint ", StringComparison.Ordinal) || line == "actionlint", "The job must run actionlint.");
    }

    // OPS-02 / T-03-23, T-03-SC: zizmor is approved at the exact action commit and zizmor version.
    [Fact]
    public void ZizmorIsPinned()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(HygienePath)).SingleOrDefault(candidate => candidate.Id == "zizmor");
        job.ShouldNotBeNull("hygiene.yml needs a job with the id zizmor (OPS-02).");
        var jobLines = job.Lines.Select(line => line.Trim()).ToList();

        jobLines.ShouldContain("name: zizmor");
        jobLines.ShouldContain("runs-on: ubuntu-24.04");
        jobLines.ShouldContain("timeout-minutes: 10");
        WorkflowText.Section(job.Lines, "permissions").Select(line => line.Trim()).ShouldBe(["contents: read"]);

        var steps = WorkflowText.Steps(job.Lines);
        var checkout = steps.Single(step => WorkflowText.StepName(step) == "checkout").Select(line => line.Trim()).ToList();
        checkout.ShouldContain("persist-credentials: false");

        var zizmor = steps.Single(step => step.Any(line => line.Contains("zizmorcore/zizmor-action", StringComparison.Ordinal))).Select(line => line.Trim()).ToList();
        zizmor.ShouldContain(line => line.StartsWith($"uses: zizmorcore/zizmor-action@{ZizmorActionCommit} #", StringComparison.Ordinal));
        zizmor.ShouldContain("version: 1.30.1");
        zizmor.ShouldContain("advanced-security: false");
        zizmor.ShouldContain("annotations: true");
    }

    [Fact]
    public void HookScansStagedChanges()
    {
        var path = RepoRoot.PathOf(HookPath);
        File.Exists(path).ShouldBeTrue($"{HookPath} must exist.");

        var text = File.ReadAllText(path);
        text.ShouldStartWith("#!/bin/sh\n");
        text.Contains('\r').ShouldBeFalse("A hook with CRLF line endings fails under sh.");

        var local = text.IndexOf("artifacts/tools/gitleaks/8.30.1/gitleaks.exe", StringComparison.Ordinal);
        var onPath = text.IndexOf("command -v gitleaks", StringComparison.Ordinal);
        local.ShouldBeGreaterThanOrEqualTo(0, "The hook looks for the pinned local install first.");
        onPath.ShouldBeGreaterThan(local, "Then for gitleaks on PATH.");

        text.ShouldContain("gitleaks git --pre-commit --staged --redact --config .gitleaks.toml");
        text.ShouldContain("Install-Gitleaks.ps1");
        text.ShouldContain("exit 0");
        text.ShouldNotContain("--no-verify");
    }

    [Fact]
    public void HookHasLfEndings() =>
        WorkflowText.Lines(AttributesPath).Select(line => line.Trim()).ShouldContain(".githooks/** text eol=lf");

    private static bool IsBroad(string value) => BroadPattern().IsMatch(value.Trim());

    // One file by exact path: anchored, with only path characters and escaped dots in between.
    private static bool IsExplicitFile(string value) => ExplicitFile().IsMatch(value);

    // Splits the file into the lines of each [[allowlists]] table; any other table header ends the current one.
    private static List<List<string>> AllowlistBlocks(IReadOnlyList<string> lines)
    {
        var blocks = new List<List<string>>();
        var inBlock = false;
        foreach (var line in lines)
        {
            var trimmed = line.Trim();
            if (trimmed == "[[allowlists]]")
            {
                blocks.Add([]);
                inBlock = true;
            }
            else if (TableHeader().IsMatch(trimmed))
            {
                inBlock = false;
            }
            else if (inBlock)
            {
                blocks[^1].Add(line);
            }
        }

        return blocks;
    }

    // Reads the quoted values of "key = [ ... ]" (single-line or multi-line) inside one allowlist block.
    private static List<string> Values(IReadOnlyList<string> block, string key)
    {
        var text = string.Join('\n', block);
        var array = Regex.Match(
            text,
            @"(?m)^\s*" + key + @"\s*=\s*\[(?<body>.*?)\] *$",
            RegexOptions.CultureInvariant | RegexOptions.Singleline);
        return array.Success
            ? QuotedValue().Matches(array.Groups["body"].Value).Select(match => match.Groups["value"].Value).ToList()
            : [];
    }

    [GeneratedRegex(@"^(?:\^|\(\?s\))*(?:\.\*|\.\+|\[\\s\\S\]\*|\[\\s\\S\]\+)?\$?$", RegexOptions.CultureInvariant)]
    private static partial Regex BroadPattern();

    [GeneratedRegex(@"^\[\[?[A-Za-z_.]+\]\]?$", RegexOptions.CultureInvariant)]
    private static partial Regex TableHeader();

    [GeneratedRegex(@"^\s*tar\s", RegexOptions.CultureInvariant)]
    private static partial Regex ExtractCommand();

    [GeneratedRegex(@"^timeout-minutes: \d+$", RegexOptions.CultureInvariant)]
    private static partial Regex TimeoutLine();

    [GeneratedRegex(@"(?m)^\s*description\s*=\s*(?:'''|"")\S", RegexOptions.CultureInvariant)]
    private static partial Regex DescriptionValue();

    [GeneratedRegex(@"'''(?<value>.*?)'''|""(?<value>[^""]*)""|'(?<value>[^']*)'", RegexOptions.CultureInvariant)]
    private static partial Regex QuotedValue();

    [GeneratedRegex(@"^\^(?:[A-Za-z0-9_/-]|\\\.)+\$$", RegexOptions.CultureInvariant)]
    private static partial Regex ExplicitFile();
}
