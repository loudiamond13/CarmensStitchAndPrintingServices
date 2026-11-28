using System.Globalization;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Doc-lint for the SEC-05 security review (<c>docs/operations/security-review.md</c>). The review is written by hand, so
/// these rules keep it honest: the CWE Top 25 (2025) rows are all there in rank order, the ATT&amp;CK techniques are all
/// there, every row has a valid status and names test files that exist, and the review holds no personal or machine details.
/// </summary>
public sealed partial class SecurityReviewDocTests
{
    private const string ReviewPath = "docs/operations/security-review.md";
    private const string CweHeading = "## CWE Top 25 (2025)";
    private const string AttackHeading = "## ATT&CK techniques";
    private const string PhaseHeading = "## Per-phase records";
    private const string CheckedHeading = "## Checked on";
    private const string UnsafeCitation = "NoUnsafeCodeTests.cs";

    private static readonly string[] ExpectedCweColumns = ["Rank", "CWE", "Name", "Status", "Mitigation", "Tests"];

    private static readonly string[] ExpectedAttackColumns = ["Technique", "Name", "Status", "Mitigation", "Tests"];

    private static readonly string[] ValidStatuses = ["Mitigated", "Not applicable"];

    // The MITRE CWE Top 25 of 2025 in rank order (cwe.mitre.org/top25/archive/2025/2025_cwe_top25.html).
    private static readonly string[] CweTop25Of2025 =
    [
        "CWE-79", "CWE-89", "CWE-352", "CWE-862", "CWE-787", "CWE-22", "CWE-416", "CWE-125", "CWE-78", "CWE-94",
        "CWE-120", "CWE-434", "CWE-476", "CWE-121", "CWE-502", "CWE-122", "CWE-863", "CWE-20", "CWE-284", "CWE-200",
        "CWE-306", "CWE-918", "CWE-77", "CWE-639", "CWE-770",
    ];

    private static readonly string[] MemorySafetyRows = ["CWE-787", "CWE-416", "CWE-125", "CWE-120", "CWE-476", "CWE-121", "CWE-122"];

    // PRD section 11.2 plus the techniques added in the Phase 14 research.
    private static readonly string[] ExpectedTechniques =
    [
        "T1110", "T1110.003", "T1110.004", "T1078", "T1190", "T1539", "T1556", "T1566", "T1499", "T1552", "T1195",
        "T1550.001", "T1621", "T1098", "T1531", "T1485", "T1565", "T1070", "T1505.003", "T1530",
    ];

    // One SECURITY.md per earlier phase, by phase number.
    private static readonly string[] EarlierPhases =
    [
        "01", "02", "03", "04", "05", "06", "07", "07.1", "08", "09", "10", "11", "12", "12.1", "13",
    ];

    private static readonly string[] TestRoots = ["tests", "web/src", "web/scripts", "web/e2e"];

    private static readonly Lazy<HashSet<string>> TestFileNames = new(IndexTestFiles);

    // Each detector paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] PrivateDetails =
    [
        (EmailAddress(), "owner@example.invalid"),
        (UserProfilePath(), "C:/Users/someone/project"),
        (UserProfilePath(), "C:\\Users\\someone\\project"),
        (ConnectionString(), "Server=db1;Database=x"),
        (ConnectionString(), "Data Source=db1"),
        (LocalDbName(), "(localdb)\\MSSQLLocalDB"),
    ];

    [Fact]
    public void TheCweTableHasTheExpectedColumns() =>
        string.Join(" | ", TableAfter(ReadReview(), CweHeading).Header)
            .ShouldBe(string.Join(" | ", ExpectedCweColumns), "The CWE table columns must be: Rank | CWE | Name | Status | Mitigation | Tests.");

    [Fact]
    public void TheCweTableListsTheTwentyFiveEntriesOfTheTwentyTwentyFiveListInRankOrder()
    {
        var rows = TableAfter(ReadReview(), CweHeading).Rows;

        rows.Select(row => row[1]).ShouldBe(CweTop25Of2025, "The CWE column must be the 2025 Top 25 in rank order, with no gap, extra or repeat.");
        rows.Select(row => row[0]).ShouldBe(Enumerable.Range(1, 25).Select(rank => rank.ToString(CultureInfo.InvariantCulture)));
    }

    [Fact]
    public void TheAttackTableHasTheExpectedColumns() =>
        string.Join(" | ", TableAfter(ReadReview(), AttackHeading).Header)
            .ShouldBe(string.Join(" | ", ExpectedAttackColumns), "The ATT&CK table columns must be: Technique | Name | Status | Mitigation | Tests.");

    [Fact]
    public void TheAttackTableListsEachRequiredTechniqueExactlyOnce() =>
        TableAfter(ReadReview(), AttackHeading).Rows.Select(row => row[0])
            .ShouldBe(ExpectedTechniques, ignoreOrder: true, "Every required technique needs exactly one row.");

    [Fact]
    public void EveryRowHasAValidStatus()
    {
        var problems = new List<string>();
        problems.AddRange(StatusProblems(TableAfter(ReadReview(), CweHeading).Rows, idColumn: 1, statusColumn: 3));
        problems.AddRange(StatusProblems(TableAfter(ReadReview(), AttackHeading).Rows, idColumn: 0, statusColumn: 2));

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void EveryRowNamesTestFilesThatExist()
    {
        var problems = new List<string>();
        foreach (var row in TableAfter(ReadReview(), CweHeading).Rows)
        {
            problems.AddRange(MissingTestFiles(row[5], TestFileNames.Value).Select(problem => $"{row[1]}: {problem}"));
        }

        foreach (var row in TableAfter(ReadReview(), AttackHeading).Rows)
        {
            problems.AddRange(MissingTestFiles(row[4], TestFileNames.Value).Select(problem => $"{row[0]}: {problem}"));
        }

        problems.ShouldBeEmpty("A mitigation is listed only with a test file that exists (SEC-05).");
    }

    [Fact]
    public void ACellNamingAMissingFileOrNoFileIsCaught()
    {
        HashSet<string> known = new(["NoInlineSqlTests.cs"], StringComparer.Ordinal);

        MissingTestFiles("`NoInlineSqlTests.cs`", known).ShouldBeEmpty();
        MissingTestFiles("`NoInlineSqlTests.cs`, `NoSuchTests.cs`", known).ShouldHaveSingleItem().ShouldContain("NoSuchTests.cs");
        MissingTestFiles("", known).ShouldHaveSingleItem().ShouldContain("no test file");
        MissingTestFiles("an unquoted name", known).ShouldHaveSingleItem().ShouldContain("no test file");
        MissingTestFiles("`tests/NoInlineSqlTests.cs`", known).ShouldHaveSingleItem().ShouldContain("file name only");
    }

    [Fact]
    public void TheMemorySafetyRowsAreNotApplicableAndCiteTheNoUnsafeCodeTest()
    {
        var rows = TableAfter(ReadReview(), CweHeading).Rows.ToDictionary(row => row[1], StringComparer.Ordinal);

        foreach (var cwe in MemorySafetyRows)
        {
            rows[cwe][3].ShouldBe("Not applicable", $"{cwe} is a memory-safety row.");
            rows[cwe][5].ShouldContain(UnsafeCitation, customMessage: $"{cwe} must cite {UnsafeCitation}.");
        }
    }

    [Fact]
    public void EveryEarlierPhaseSecurityRecordIsLinkedAndTheLinkResolves()
    {
        var section = SectionAfter(ReadReview(), PhaseHeading);
        var targets = PhaseLink().Matches(string.Join('\n', section)).Select(match => match.Groups["target"].Value).ToList();
        var reviewDirectory = Path.GetDirectoryName(RepoRoot.PathOf(ReviewPath))!;
        var problems = new List<string>();

        foreach (var phase in EarlierPhases)
        {
            var matching = targets.Where(target => Path.GetFileName(target) == $"{phase}-SECURITY.md").ToList();
            if (matching.Count != 1)
            {
                problems.Add($"Phase {phase} must be linked exactly once as {phase}-SECURITY.md (found {matching.Count}).");
            }
        }

        foreach (var target in targets)
        {
            var path = Path.GetFullPath(Path.Combine(reviewDirectory, target.Replace('/', Path.DirectorySeparatorChar)));
            if (!File.Exists(path))
            {
                problems.Add($"The link '{target}' does not resolve to a file.");
            }
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void ItRecordsTheDateTheListsWereChecked()
    {
        var section = string.Join('\n', SectionAfter(ReadReview(), CheckedHeading));
        var date = CheckedDate().Match(section);

        date.Success.ShouldBeTrue("The 'Checked on' section must give the check date as yyyy-MM-dd.");
        DateOnly.TryParseExact(date.Groups["date"].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            .ShouldBeTrue("The check date must be a real date.");
        section.ShouldContain("2025");
        section.ShouldContain("attack.mitre.org");
    }

    [Fact]
    public void ItCarriesCreatedAndUpdatedTimestamps() =>
        TimestampLine().IsMatch(ReadReview()).ShouldBeTrue("Under the title: *Created: <ISO 8601 with offset> · Updated: <ISO 8601 with offset>*.");

    [Fact]
    public void ItHoldsNoPersonalOrMachineDetails()
    {
        foreach (var (pattern, sample) in PrivateDetails)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var text = ReadReview();
        var found = PrivateDetails.Select(detector => detector.Pattern).Distinct()
            .SelectMany(pattern => pattern.Matches(text).Select(match => match.Value))
            .ToList();

        found.ShouldBeEmpty("The review names controls and test files only: no email, local path, server or database name.");
    }

    private static List<string> StatusProblems(List<List<string>> rows, int idColumn, int statusColumn)
    {
        var problems = new List<string>();
        foreach (var row in rows)
        {
            if (!ValidStatuses.Contains(row[statusColumn], StringComparer.Ordinal))
            {
                problems.Add($"{row[idColumn]} has status '{row[statusColumn]}'; use Mitigated or Not applicable.");
            }
        }

        return problems;
    }

    // A Tests cell is a comma list of back-ticked file names. Each must be a bare file name that exists in the test trees.
    private static List<string> MissingTestFiles(string cell, HashSet<string> known)
    {
        var names = BackTicked().Matches(cell).Select(match => match.Groups["name"].Value).ToList();
        if (names.Count == 0)
        {
            return ["names no test file in back-ticks"];
        }

        var problems = new List<string>();
        foreach (var name in names)
        {
            if (name.Contains('/') || name.Contains('\\'))
            {
                problems.Add($"'{name}' must be a file name only");
            }
            else if (!known.Contains(name))
            {
                problems.Add($"'{name}' does not exist under tests, web/src, web/scripts or web/e2e");
            }
        }

        return problems;
    }

    private static HashSet<string> IndexTestFiles()
    {
        HashSet<string> names = new(StringComparer.Ordinal);
        foreach (var root in TestRoots)
        {
            var path = RepoRoot.PathOf(root);
            if (!Directory.Exists(path))
            {
                continue;
            }

            foreach (var file in Directory.EnumerateFiles(path, "*.*", SearchOption.AllDirectories))
            {
                var segments = file.Split('/', '\\');
                if (!segments.Any(segment => segment is "bin" or "obj" or "node_modules"))
                {
                    names.Add(Path.GetFileName(file));
                }
            }
        }

        return names;
    }

    private static string ReadReview()
    {
        var path = RepoRoot.PathOf(ReviewPath);
        File.Exists(path).ShouldBeTrue($"{ReviewPath} is missing.");
        return File.ReadAllText(path);
    }

    private static List<string> SectionAfter(string text, string heading)
    {
        var lines = text.ReplaceLineEndings("\n").Split('\n');
        var start = Array.FindIndex(lines, line => string.Equals(line.Trim(), heading, StringComparison.Ordinal));
        start.ShouldBeGreaterThanOrEqualTo(0, $"{ReviewPath} has no '{heading}' section.");

        return lines.Skip(start + 1).TakeWhile(line => !line.StartsWith("## ", StringComparison.Ordinal)).ToList();
    }

    private static (List<string> Header, List<List<string>> Rows) TableAfter(string text, string heading)
    {
        var tableLines = SectionAfter(text, heading)
            .SkipWhile(line => !line.TrimStart().StartsWith('|'))
            .TakeWhile(line => line.TrimStart().StartsWith('|'))
            .ToList();
        tableLines.Count.ShouldBeGreaterThanOrEqualTo(2, $"The '{heading}' section has no markdown table.");
        TableSeparator().IsMatch(tableLines[1]).ShouldBeTrue($"The '{heading}' table's second line must be its |---| separator.");

        var header = Cells(tableLines[0]);
        var rows = tableLines.Skip(2).Select(Cells).ToList();
        foreach (var row in rows)
        {
            row.Count.ShouldBe(header.Count, $"A row in '{heading}' has {row.Count} cells instead of {header.Count}: {row[0]}");
        }

        return (header, rows);
    }

    private static List<string> Cells(string line)
    {
        var trimmed = line.Trim();
        var inner = trimmed.Substring(1, trimmed.EndsWith('|') ? trimmed.Length - 2 : trimmed.Length - 1);
        return UnescapedPipe().Split(inner).Select(cell => cell.Trim()).ToList();
    }

    [GeneratedRegex(@"`(?<name>[^`]+)`", RegexOptions.CultureInvariant)]
    private static partial Regex BackTicked();

    [GeneratedRegex(@"\]\((?<target>[^)\s]+)\)", RegexOptions.CultureInvariant)]
    private static partial Regex PhaseLink();

    [GeneratedRegex(@"\b(?<date>\d{4}-\d{2}-\d{2})\b", RegexOptions.CultureInvariant)]
    private static partial Regex CheckedDate();

    [GeneratedRegex(@"^\*Created: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2} · Updated: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}\*$", RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex TimestampLine();

    [GeneratedRegex(@"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z0-9.-]+", RegexOptions.CultureInvariant)]
    private static partial Regex EmailAddress();

    [GeneratedRegex(@"[A-Za-z]:[\\/]+Users[\\/]", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserProfilePath();

    [GeneratedRegex(@"\b(Server|Data Source|Initial Catalog|Database)\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ConnectionString();

    [GeneratedRegex(@"\(localdb\)", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex LocalDbName();

    [GeneratedRegex(@"^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex TableSeparator();

    [GeneratedRegex(@"(?<!\\)\|", RegexOptions.CultureInvariant)]
    private static partial Regex UnescapedPipe();
}
