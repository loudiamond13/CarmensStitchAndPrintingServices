using System.Text;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// OPS-04 rules for the production deploy: a manual, main-only, least-privilege workflow that hands everything to the
/// tested orchestrator through env, the branded offline page, and the runbook (threats T-03-47 to T-03-51).
/// </summary>
public sealed partial class DeployWorkflowTests
{
    private const string DeployPath = ".github/workflows/deploy.yml";
    private const string OfflineDirectory = "tools/deploy";
    private const string OfflineFileName = "app_offline.htm";
    private const string RunbookPath = "docs/operations/deploy.md";
    private const int OfflineSizeLimit = 8192;

    private static readonly string[] PackageRoots = ["web", "src"];

    private static readonly string[] OrchestratorScripts = ["web/scripts/deploy.mjs", "web/scripts/smoke.mjs"];

    // Every value deploy.mjs reads (plan 03-06), as the env line the deploy step must carry.
    private static readonly string[] OrchestratorEnv =
    [
        "INPUT_ACTION: ${{ inputs.action }}",
        "INPUT_SHA: ${{ inputs.sha }}",
        "INPUT_DRY_RUN: ${{ inputs.dry_run }}",
        "INPUT_PROBE_REWRITE: ${{ inputs.probe_rewrite }}",
        "WEBDEPLOY_SERVER: ${{ secrets.WEBDEPLOY_SERVER }}",
        "WEBDEPLOY_SITE: ${{ secrets.WEBDEPLOY_SITE }}",
        "WEBDEPLOY_USERNAME: ${{ secrets.WEBDEPLOY_USERNAME }}",
        "WEBDEPLOY_PASSWORD: ${{ secrets.WEBDEPLOY_PASSWORD }}",
        "WEBDEPLOY_CERT_SHA256: ${{ secrets.WEBDEPLOY_CERT_SHA256 }}",
        "HOSTPROBE_KEY: ${{ secrets.HOSTPROBE_KEY }}",
        "SITE_ORIGIN: ${{ vars.SITE_ORIGIN }}",
        "GH_TOKEN: ${{ github.token }}",
        "GH_REPO: ${{ github.repository }}",
    ];

    // One heading keyword per situation the runbook must cover.
    private static readonly string[] RunbookHeadings =
    [
        "how to deploy",
        "dry run",
        "roll back by hand",
        "online action",
        "first deploy",
        "legacy rollback kit",
        "secrets and variables",
        "migrations",
        "who can deploy",
    ];

    [Fact]
    public void DeployIsManualOnly()
    {
        var lines = WorkflowText.Lines(DeployPath);
        lines.ShouldNotBeEmpty($"{DeployPath} is the OPS-04 deploy workflow and must exist.");

        var triggers = WorkflowText.Section(lines, "on");
        triggers.Where(line => IndentOf(line) == 2).Select(line => line.Trim()).ToList()
            .ShouldBe(["workflow_dispatch:"], "D-11: a deploy runs only when the owner presses Run; no push, schedule or other trigger.");
    }

    [Fact]
    public void DeployRunsOnlyFromMain()
    {
        var job = DeployJob();

        job.Lines.ShouldContain("    if: github.ref == 'refs/heads/main'", "The deploy job runs only on main (research Pattern 4).");
    }

    [Fact]
    public void DeployHasLeastPrivilege()
    {
        var lines = WorkflowText.Lines(DeployPath);
        lines.ShouldContain("permissions: {}", "The token starts with no rights (T-03-02).");

        WorkflowText.Section(DeployJob().Lines, "permissions").Select(line => line.Trim()).Order(StringComparer.Ordinal).ToList()
            .ShouldBe(["actions: read", "contents: write"], "contents write creates the deploy release and actions read finds the CI package, nothing more (T-03-49).");
    }

    [Fact]
    public void DeployNeverCancels()
    {
        WorkflowText.Section(WorkflowText.Lines(DeployPath), "concurrency").Select(line => line.Trim()).ToList()
            .ShouldBe(["group: deploy-production", "cancel-in-progress: false"], "Two deploys never run at once, and a running one is never cancelled (T-03-51).");
    }

    [Fact]
    public void DeployInputsAndSecretsUseEnv()
    {
        var lines = WorkflowText.Lines(DeployPath);
        var inputs = WorkflowText.Section(WorkflowText.Section(WorkflowText.Section(lines, "on"), "workflow_dispatch"), "inputs");

        InputLines(inputs, "action").ShouldContain("type: choice");
        InputLines(inputs, "action").ShouldContain("- deploy");
        InputLines(inputs, "action").ShouldContain("- online");
        InputLines(inputs, "action").ShouldContain("- hostprobe");
        InputLines(inputs, "sha").ShouldContain("type: string");
        InputLines(inputs, "dry_run").ShouldContain("type: boolean");
        InputLines(inputs, "probe_rewrite").ShouldContain("type: boolean");
        foreach (var name in new[] { "action", "sha", "dry_run", "probe_rewrite" })
        {
            InputLines(inputs, name).ShouldContain(line => line.StartsWith("description:", StringComparison.Ordinal), $"The {name} input needs a description for the Run workflow form.");
        }

        var offenders = lines.Where(IsInjectionSink).Select(line => line.Trim()).ToList();
        offenders.ShouldBeEmpty("Inputs and secrets reach the script through env: only, never in run: or any other key (CWE-77, T-03-48).");

        IsInjectionSink("        run: node web/scripts/deploy.mjs ${{ inputs.sha }}").ShouldBeTrue();
        IsInjectionSink("        run: echo ${{ secrets.WEBDEPLOY_PASSWORD }}").ShouldBeTrue();
        IsInjectionSink("          INPUT_SHA: ${{ inputs.sha }}").ShouldBeFalse();
        IsInjectionSink("        if: inputs.action == 'hostprobe'").ShouldBeFalse();

        var step = DeployStep().Select(line => line.Trim()).ToList();
        foreach (var entry in OrchestratorEnv)
        {
            step.ShouldContain(entry, $"deploy.mjs reads {entry.Split(':')[0]}; the deploy step must pass it through env:.");
        }
    }

    [Fact]
    public void DeployRunsTheOrchestratorOnly()
    {
        var job = DeployJob();
        var lines = job.Lines;

        lines.ShouldContain("    name: deploy");
        lines.ShouldContain("    runs-on: windows-2025");
        lines.ShouldContain("    timeout-minutes: 30");

        WorkflowText.RunBlocks(lines).ShouldBe(["node web/scripts/deploy.mjs"], "The job has one run step, the orchestrator, and installs no npm package.");

        var steps = WorkflowText.Steps(lines);

        var checkout = StepUsing(steps, "actions/checkout@");
        checkout.ShouldContain("persist-credentials: false");

        var node = StepUsing(steps, "actions/setup-node@");
        node.ShouldContain("node-version: \"24.21.0\"");
        node.ShouldNotContain(line => line.StartsWith("cache", StringComparison.Ordinal), "The deploy runner installs and caches no npm package.");

        var dotnet = StepUsing(steps, "actions/setup-dotnet@");
        dotnet.ShouldContain("if: inputs.action == 'hostprobe'", "Only the host probe needs the .NET SDK.");
        dotnet.ShouldContain("global-json-file: global.json");
    }

    [Fact]
    public void DeployScriptsUseBuiltInsOnly()
    {
        foreach (var script in OrchestratorScripts)
        {
            var imports = ImportedModules(File.ReadAllLines(RepoRoot.PathOf(script)));
            imports.ShouldNotBeEmpty($"{script} imports nothing, so the import reader is not working.");
            imports.Where(module => !IsBuiltInOrLocal(module)).ToList()
                .ShouldBeEmpty($"{script} runs without npm ci, so it may import only node: built-ins and its own files (T-03-SC).");
        }

        ImportedModules(["import axios from 'axios';"]).ShouldBe(["axios"]);
        ImportedModules(["} from 'zod';"]).ShouldBe(["zod"]);
        ImportedModules(["const x = await import('left-pad');"]).ShouldBe(["left-pad"]);
        ImportedModules(["import path from 'node:path';", "// import x from 'comment';"]).ShouldBe(["node:path"]);
        IsBuiltInOrLocal("node:path").ShouldBeTrue();
        IsBuiltInOrLocal("./smoke.mjs").ShouldBeTrue();
        IsBuiltInOrLocal("path").ShouldBeFalse();
        IsBuiltInOrLocal("axios").ShouldBeFalse();
    }

    [Fact]
    public void OfflinePageIsSelfContained()
    {
        var path = RepoRoot.PathOf($"{OfflineDirectory}/{OfflineFileName}");
        File.Exists(path).ShouldBeTrue($"{OfflineDirectory}/{OfflineFileName} is the branded page deploy.mjs uploads (D-12).");

        System.IO.Directory.GetFiles(RepoRoot.PathOf(OfflineDirectory)).Select(Path.GetFileName)
            .ShouldContain(OfflineFileName, "The file name is lowercase: IIS matches app_offline.htm by exact name.");

        var bytes = File.ReadAllBytes(path);
        bytes.Length.ShouldBeLessThan(OfflineSizeLimit);
        bytes.Length.ShouldBeGreaterThan(511, "A page under 512 bytes is replaced by a browser's own error page.");

        var html = new UTF8Encoding(false, true).GetString(bytes);
        html.ShouldContain("lang=\"en-PH\"");
        html.ShouldContain("<meta charset=\"utf-8\">");
        html.ShouldContain("<meta http-equiv=\"refresh\" content=\"30\">");
        html.ShouldContain("name=\"viewport\"");
        html.ShouldContain("<style>");
        html.ShouldContain("<svg");
        html.ShouldContain("back in a minute");
        html.ShouldContain("Carmen's Stitch &amp; Printing Services");
        html.ShouldContain("#f6dfd1", Case.Insensitive, "The page uses the Blush background by value.");
        html.ShouldContain("#ff6600", Case.Insensitive, "The page uses the brand orange by value.");

        // ANCM answers every path with this one file, so nothing may be fetched from the site or anywhere else.
        foreach (var forbidden in new[] { "<script", "<link", "<img", "<iframe", "@import", "http://", "https://", "=\"//", "src=\"/", "href=\"/" })
        {
            html.ShouldNotContain(forbidden, Case.Insensitive);
        }

        FileUrl().IsMatch(html).ShouldBeFalse("url() may only point inside the page (#id).");
        FileUrl().IsMatch("a { background: url(/assets/x.png) }").ShouldBeTrue();
        html.ShouldNotContain("–", customMessage: "No en dash (OR-4).");
        html.ShouldNotContain("—", customMessage: "No em dash (OR-4).");
    }

    [Fact]
    public void OfflinePageNeverShips()
    {
        var offenders = PackageRoots
            .SelectMany(root => FilesUnder(RepoRoot.PathOf(root)))
            .Where(path => string.Equals(Path.GetFileName(path), OfflineFileName, StringComparison.OrdinalIgnoreCase))
            .Select(path => Path.GetRelativePath(RepoRoot.Find(), path))
            .ToList();

        offenders.ShouldBeEmpty("An app_offline.htm inside a package would take the site offline by itself (research Pitfall 7).");
    }

    [Fact]
    public void DeployRunbookCoversTheCases()
    {
        var lines = WorkflowText.Lines(RunbookPath);
        lines.ShouldNotBeEmpty($"{RunbookPath} is the deploy runbook.");

        var headings = lines.Where(line => line.StartsWith('#')).ToList();
        foreach (var keyword in RunbookHeadings)
        {
            headings.ShouldContain(heading => heading.Contains(keyword, StringComparison.OrdinalIgnoreCase), $"The runbook needs a heading about: {keyword}.");
        }

        lines.ShouldContain(line => RunbookTimestamp().IsMatch(line), "The runbook carries Created and Updated timestamps.");

        var text = string.Join('\n', lines);
        foreach (var name in new[] { "WEBDEPLOY_SERVER", "WEBDEPLOY_SITE", "WEBDEPLOY_USERNAME", "WEBDEPLOY_PASSWORD", "WEBDEPLOY_CERT_SHA256", "HOSTPROBE_KEY", "SITE_ORIGIN", "csps-migrations.sql", "gh workflow run deploy.yml --ref main" })
        {
            text.ShouldContain(name);
        }
    }

    private static WorkflowJob DeployJob()
    {
        var job = WorkflowText.Jobs(WorkflowText.Lines(DeployPath)).SingleOrDefault(candidate => candidate.Id == "deploy");
        job.ShouldNotBeNull("deploy.yml needs a job with the id deploy.");
        return job;
    }

    private static IReadOnlyList<string> DeployStep() =>
        WorkflowText.Steps(DeployJob().Lines).Single(step => step.Any(line => line.Trim() == "run: node web/scripts/deploy.mjs"));

    private static List<string> StepUsing(IReadOnlyList<IReadOnlyList<string>> steps, string action) =>
        steps.Single(step => step.Any(line => line.Contains(action, StringComparison.Ordinal)))
            .Select(line => line.Trim())
            .ToList();

    private static List<string> InputLines(IReadOnlyList<string> inputs, string name) =>
        WorkflowText.Section(inputs, name).Select(line => line.Trim()).ToList();

    // A secrets or inputs expression is allowed only as an env entry (name: ${{ ... }}) or inside an if: condition.
    private static bool IsInjectionSink(string line)
    {
        var trimmed = line.Trim();
        if (trimmed.StartsWith('#') || !SecretOrInput().IsMatch(line))
        {
            return false;
        }

        return !trimmed.StartsWith("if:", StringComparison.Ordinal) && !EnvEntry().IsMatch(line);
    }

    private static List<string> ImportedModules(IEnumerable<string> lines) =>
        lines
            .Where(line => !line.TrimStart().StartsWith("//", StringComparison.Ordinal) && !line.TrimStart().StartsWith('*'))
            .SelectMany(line => ModuleReference().Matches(line).Select(match => match.Groups["module"].Value))
            .ToList();

    private static bool IsBuiltInOrLocal(string module) =>
        module.StartsWith("node:", StringComparison.Ordinal)
        || module.StartsWith("./", StringComparison.Ordinal)
        || module.StartsWith("../", StringComparison.Ordinal);

    private static IEnumerable<string> FilesUnder(string root)
    {
        if (!System.IO.Directory.Exists(root))
        {
            yield break;
        }

        foreach (var file in System.IO.Directory.EnumerateFiles(root))
        {
            yield return file;
        }

        foreach (var directory in System.IO.Directory.EnumerateDirectories(root))
        {
            if (Path.GetFileName(directory) is "node_modules" or "bin" or "obj")
            {
                continue;
            }

            foreach (var file in FilesUnder(directory))
            {
                yield return file;
            }
        }
    }

    private static int IndentOf(string line) => line.Length - line.TrimStart(' ').Length;

    [GeneratedRegex(@"\$\{\{\s*(?:secrets|inputs)\.", RegexOptions.CultureInvariant)]
    private static partial Regex SecretOrInput();

    [GeneratedRegex(@"^ {10}[A-Z][A-Z0-9_]*: \$\{\{ (?:secrets|inputs)\.\w+ \}\}\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex EnvEntry();

    [GeneratedRegex(@"(?:\bfrom\s+|\bimport\s*\(?\s*|\brequire\s*\(\s*)'(?<module>[^']+)'", RegexOptions.CultureInvariant)]
    private static partial Regex ModuleReference();

    [GeneratedRegex(@"url\(\s*['""]?(?!#)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex FileUrl();

    [GeneratedRegex(@"^\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00 · Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}-05:00\*$", RegexOptions.CultureInvariant)]
    private static partial Regex RunbookTimestamp();
}
