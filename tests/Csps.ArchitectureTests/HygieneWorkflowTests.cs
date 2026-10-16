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

    // Research "Supporting (CLI tools)" table, owner-approved in plan 03-01 Task 1.
    private const string Version = "8.30.1";
    private const string LinuxSha256 = "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb";
    private const string WindowsSha256 = "d29144deff3a68aa93ced33dddf84b7fdc26070add4aa0f4513094c8332afc4e";
    private const string LinuxAsset = "gitleaks_8.30.1_linux_x64.tar.gz";

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

    [GeneratedRegex(@"^(?:\^|\(\?s\))*(?:\.\*|\.\+|\[\s\S\]\*|\[\s\S\]\+)?\$?$", RegexOptions.CultureInvariant)]
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

    [GeneratedRegex(@"^\^[A-Za-z0-9_/-]+(?:\\\.[A-Za-z0-9_/-]+)*\$$", RegexOptions.CultureInvariant)]
    private static partial Regex ExplicitFile();
}
