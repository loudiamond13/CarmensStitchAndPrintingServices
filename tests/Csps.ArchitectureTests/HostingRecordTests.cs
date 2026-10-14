using System.Globalization;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Doc-lint for the FND-13 hosting record (D-09, D-12, D-28; threat T-01-42). The record is filled in by hand from
/// owner-pasted results, so these rules keep its shape stable, stop a fact from being marked Verified without a
/// result and a date, and keep credentials, connection strings, private keys and probe keys out of git.
/// </summary>
public sealed partial class HostingRecordTests
{
    private const string RecordPath = ".planning/HOSTING-RECORD.md";
    private const string FactsHeading = "## Facts";

    private static readonly string[] ExpectedColumns = ["Fact", "How to check", "Result", "Status", "Date"];

    private static readonly string[] RequiredFacts =
    [
        ".NET runtime patch",
        "SQL Server @@VERSION",
        "Database compatibility level (new databases / model)",
        "Server collation",
        "In-process hosting",
        "Client IP / proxy topology",
        "SPF",
        "DKIM",
        "DMARC",
        "Scheduler availability",
        "Database size quota",
        "Staging-site option",
    ];

    private static readonly string[] ValidStatuses = ["Verified", "Unverified", "N/A"];

    // Results that mean "nothing observed yet". A Verified fact needs a real observed result.
    private static readonly string[] PlaceholderResults = ["", "-", "—", "–", "?", "TBD", "TODO", "n/a", "unknown"];

    // Each detector paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] SecretDetectors =
    [
        (PasswordAssignment(), "Server=x;Password = hunter2"),
        (PasswordAssignment(), "PWD=hunter2"),
        (UserIdAssignment(), "User ID=csps_owner;"),
        (AccountKeyAssignment(), "AccountKey=abc123"),
        (PemBlock(), "-----BEGIN PRIVATE KEY-----"),
        (ProbeKeyValue(), "curl -H \"X-Probe-Key: 0123456789abcdef\" https://probe.example/probe"),
    ];

    [Fact]
    public void HasFactsTableWithRequiredRows()
    {
        var table = FactsTable(ReadRecord());

        string.Join(" | ", table.Header).ShouldBe(
            string.Join(" | ", ExpectedColumns), "The Facts table columns must be: Fact | How to check | Result | Status | Date.");
        var facts = table.Rows.Select(row => row[0]).ToList();
        var missing = RequiredFacts.Where(required => !facts.Contains(required, StringComparer.Ordinal)).ToList();
        missing.ShouldBeEmpty("Every FND-13 fact needs its own row in the Facts table.");
    }

    [Fact]
    public void StatusesAreValid()
    {
        var table = FactsTable(ReadRecord());
        table.Rows.ShouldNotBeEmpty("The Facts table has no rows.");

        var problems = new List<string>();
        foreach (var row in table.Rows)
        {
            if (row.Count != ExpectedColumns.Length)
            {
                problems.Add($"'{row[0]}' has {row.Count} cells instead of {ExpectedColumns.Length}.");
                continue;
            }

            var (fact, result, status, date) = (row[0], row[2], row[3], row[4]);
            if (!ValidStatuses.Contains(status, StringComparer.Ordinal))
            {
                problems.Add($"'{fact}' has status '{status}'; use Verified, Unverified or N/A.");
            }

            if (string.Equals(status, "Verified", StringComparison.Ordinal))
            {
                if (PlaceholderResults.Contains(result.Trim(), StringComparer.OrdinalIgnoreCase))
                {
                    problems.Add($"'{fact}' is Verified without an observed result.");
                }

                if (!DateOnly.TryParseExact(date, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _))
                {
                    problems.Add($"'{fact}' is Verified without a yyyy-MM-dd date (got '{date}').");
                }
            }
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void ContainsNoSecrets()
    {
        foreach (var (pattern, sample) in SecretDetectors)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var text = ReadRecord();
        var found = SecretDetectors
            .Select(detector => detector.Pattern)
            .Distinct()
            .SelectMany(pattern => pattern.Matches(text).Select(match => match.Value))
            .ToList();

        found.ShouldBeEmpty("The hosting record must never hold passwords, user ids, account keys, private keys or probe keys.");
    }

    [Fact]
    public void RecordsTheD28Decision()
    {
        var decision = D28DecisionLine().Match(ReadRecord());

        decision.Success.ShouldBeTrue("The record must start with 'D-28 decision: option-a|option-b|option-c (yyyy-MM-dd)'.");
        DateOnly.TryParseExact(
                decision.Groups["date"].Value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
            .ShouldBeTrue("The D-28 decision date must be a real yyyy-MM-dd date.");
    }

    private static string ReadRecord()
    {
        var path = RepoRoot.PathOf(RecordPath);
        File.Exists(path).ShouldBeTrue($"{RecordPath} is missing.");
        return File.ReadAllText(path);
    }

    private static (List<string> Header, List<List<string>> Rows) FactsTable(string text)
    {
        var lines = text.ReplaceLineEndings("\n").Split('\n');
        var start = Array.FindIndex(lines, line => string.Equals(line.Trim(), FactsHeading, StringComparison.Ordinal));
        start.ShouldBeGreaterThanOrEqualTo(0, $"{RecordPath} has no '{FactsHeading}' section.");

        var tableLines = lines
            .Skip(start + 1)
            .TakeWhile(line => !line.StartsWith("## ", StringComparison.Ordinal))
            .SkipWhile(line => !line.TrimStart().StartsWith('|'))
            .TakeWhile(line => line.TrimStart().StartsWith('|'))
            .ToList();
        tableLines.Count.ShouldBeGreaterThanOrEqualTo(2, $"The '{FactsHeading}' section has no markdown table.");
        TableSeparator().IsMatch(tableLines[1]).ShouldBeTrue("The Facts table's second line must be its |---| separator.");

        return (Cells(tableLines[0]), tableLines.Skip(2).Select(Cells).ToList());
    }

    private static List<string> Cells(string line)
    {
        var trimmed = line.Trim();
        var inner = trimmed.Substring(1, trimmed.EndsWith('|') ? trimmed.Length - 2 : trimmed.Length - 1);
        return UnescapedPipe().Split(inner).Select(cell => cell.Trim()).ToList();
    }

    [GeneratedRegex(@"\b(password|pwd)\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex PasswordAssignment();

    [GeneratedRegex(@"\bUser\s*ID\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserIdAssignment();

    [GeneratedRegex(@"\bAccountKey\s*=", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex AccountKeyAssignment();

    [GeneratedRegex("-----BEGIN", RegexOptions.CultureInvariant)]
    private static partial Regex PemBlock();

    // A real key value after the header name. Angle-bracket placeholders such as <your-probe-key> do not match.
    [GeneratedRegex(@"X-Probe-Key\s*:\s*[A-Za-z0-9+/=_\-]{8,}", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex ProbeKeyValue();

    [GeneratedRegex(@"^D-28 decision:.*\boption-[abc]\b.*?(?<date>\d{4}-\d{2}-\d{2})", RegexOptions.CultureInvariant | RegexOptions.Multiline)]
    private static partial Regex D28DecisionLine();

    [GeneratedRegex(@"^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex TableSeparator();

    [GeneratedRegex(@"(?<!\\)\|", RegexOptions.CultureInvariant)]
    private static partial Regex UnescapedPipe();
}
