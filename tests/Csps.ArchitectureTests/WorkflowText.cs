using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>One job block of a workflow file: its id and the lines under it (blank and comment lines dropped).</summary>
internal sealed record WorkflowJob(string Id, IReadOnlyList<string> Lines);

/// <summary>
/// Line-based reader for the files in .github/workflows. It reads the block style these workflows are written in
/// (jobs at two spaces, job keys at four, steps at six) and needs no YAML package.
/// </summary>
internal static partial class WorkflowText
{
    public const string WorkflowsDirectory = ".github/workflows";

    /// <summary>Repo-relative paths of every .yml file in the workflows folder.</summary>
    public static IReadOnlyList<string> Files() =>
        Entries()
            .Where(path => path.EndsWith(".yml", StringComparison.Ordinal))
            .ToList();

    /// <summary>Repo-relative paths of workflow-folder files GitHub would run but the tests would not read (.yaml).</summary>
    public static IReadOnlyList<string> UnreadFiles() =>
        Entries()
            .Where(path => path.EndsWith(".yaml", StringComparison.OrdinalIgnoreCase))
            .ToList();

    /// <summary>All lines of a file, or none when it does not exist yet.</summary>
    public static IReadOnlyList<string> Lines(string relativePath)
    {
        var path = RepoRoot.PathOf(relativePath);
        return File.Exists(path) ? File.ReadAllLines(path) : [];
    }

    /// <summary>Splits the top-level <c>jobs:</c> section into one block per job.</summary>
    public static IReadOnlyList<WorkflowJob> Jobs(IReadOnlyList<string> lines)
    {
        var jobs = new List<WorkflowJob>();
        List<string>? current = null;
        string? currentId = null;
        var inJobs = false;

        foreach (var line in lines)
        {
            if (!inJobs)
            {
                inJobs = line.TrimEnd() == "jobs:";
                continue;
            }

            if (IsBlankOrComment(line))
            {
                continue;
            }

            if (IndentOf(line) == 0)
            {
                break;
            }

            var header = JobHeader().Match(line);
            if (header.Success)
            {
                current = [line];
                currentId = header.Groups["id"].Value;
                jobs.Add(new WorkflowJob(currentId, current));
            }
            else
            {
                current?.Add(line);
            }
        }

        return jobs;
    }

    /// <summary>Single-line <c>run:</c> values and the bodies of <c>run: |</c> blocks.</summary>
    public static IReadOnlyList<string> RunBlocks(IReadOnlyList<string> lines)
    {
        var blocks = new List<string>();
        for (var i = 0; i < lines.Count; i++)
        {
            var match = RunKey().Match(lines[i]);
            if (!match.Success)
            {
                continue;
            }

            var value = match.Groups["value"].Value.Trim();
            if (!BlockScalar().IsMatch(value))
            {
                blocks.Add(value);
                continue;
            }

            var keyIndent = match.Groups["indent"].Length + (match.Groups["dash"].Success ? 2 : 0);
            var body = new List<string>();
            for (var j = i + 1; j < lines.Count && (lines[j].Trim().Length == 0 || IndentOf(lines[j]) > keyIndent); j++)
            {
                body.Add(lines[j].Trim());
            }

            blocks.Add(string.Join('\n', body));
        }

        return blocks;
    }

    /// <summary>The value of every <c>uses:</c> key, including its trailing comment.</summary>
    public static IReadOnlyList<string> UsesValues(IReadOnlyList<string> lines) =>
        lines
            .Select(line => UsesKey().Match(line))
            .Where(match => match.Success)
            .Select(match => match.Groups["value"].Value)
            .ToList();

    /// <summary>Splits a job block into its steps, each starting at its <c>- </c> line.</summary>
    public static IReadOnlyList<IReadOnlyList<string>> Steps(IReadOnlyList<string> jobLines)
    {
        var steps = new List<List<string>>();
        var inSteps = false;

        foreach (var line in jobLines)
        {
            if (!inSteps)
            {
                inSteps = line.TrimEnd() == "    steps:";
                continue;
            }

            if (StepStart().IsMatch(line))
            {
                steps.Add([line]);
            }
            else if (IndentOf(line) <= 4)
            {
                break;
            }
            else if (steps.Count > 0)
            {
                steps[^1].Add(line);
            }
        }

        return steps.Select(IReadOnlyList<string> (step) => step).ToList();
    }

    /// <summary>The <c>name:</c> of a step, or null when it has none.</summary>
    public static string? StepName(IReadOnlyList<string> step) =>
        step.Select(line => StepNameKey().Match(line))
            .Where(match => match.Success)
            .Select(match => match.Groups["name"].Value)
            .FirstOrDefault();

    /// <summary>The step names of a job block, in order.</summary>
    public static IReadOnlyList<string> StepNames(IReadOnlyList<string> jobLines) =>
        Steps(jobLines)
            .Select(StepName)
            .OfType<string>()
            .ToList();

    /// <summary>The lines nested under the first <paramref name="key"/> found (blank and comment lines dropped).</summary>
    public static IReadOnlyList<string> Section(IReadOnlyList<string> lines, string key)
    {
        for (var i = 0; i < lines.Count; i++)
        {
            if (!lines[i].TrimStart().StartsWith(key + ":", StringComparison.Ordinal))
            {
                continue;
            }

            var indent = IndentOf(lines[i]);
            var body = new List<string>();
            for (var j = i + 1; j < lines.Count; j++)
            {
                if (IsBlankOrComment(lines[j]))
                {
                    continue;
                }

                if (IndentOf(lines[j]) <= indent)
                {
                    break;
                }

                body.Add(lines[j]);
            }

            return body;
        }

        return [];
    }

    private static IEnumerable<string> Entries()
    {
        var directory = RepoRoot.PathOf(WorkflowsDirectory);
        if (!System.IO.Directory.Exists(directory))
        {
            return [];
        }

        return System.IO.Directory.EnumerateFiles(directory, "*", SearchOption.TopDirectoryOnly)
            .Select(path => $"{WorkflowsDirectory}/{Path.GetFileName(path)}")
            .Order(StringComparer.Ordinal);
    }

    private static int IndentOf(string line) => line.Length - line.TrimStart(' ').Length;

    private static bool IsBlankOrComment(string line)
    {
        var trimmed = line.Trim();
        return trimmed.Length == 0 || trimmed.StartsWith('#');
    }

    [GeneratedRegex(@"^  (?<id>[A-Za-z0-9_-]+):\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex JobHeader();

    [GeneratedRegex(@"^(?<indent> *)(?<dash>- )?run:\s*(?<value>.*)$", RegexOptions.CultureInvariant)]
    private static partial Regex RunKey();

    [GeneratedRegex(@"^[|>][+-]?\d*$", RegexOptions.CultureInvariant)]
    private static partial Regex BlockScalar();

    [GeneratedRegex(@"^\s*(?:- )?uses:\s*(?<value>\S.*?)\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex UsesKey();

    [GeneratedRegex(@"^ {6}- ", RegexOptions.CultureInvariant)]
    private static partial Regex StepStart();

    [GeneratedRegex(@"^(?: {6}- | {8})name:\s*(?<name>\S.*?)\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex StepNameKey();
}
