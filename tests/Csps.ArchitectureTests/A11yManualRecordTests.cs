using System.Globalization;
using System.Text.RegularExpressions;

namespace Csps.ArchitectureTests;

/// <summary>
/// Doc-lint for the manual accessibility record (<c>docs/operations/a11y-manual-passes.md</c>; A11Y-05, 14 D-08 to D-10,
/// D-22, D-43). The owner fills in the results by hand, so these rules keep the record's shape stable: all eight flows are
/// scripted, every result is Pass, Fail or Not run, a Fail always has an outcome, a pass is never recorded without a date,
/// the sign-off line has one format, and no email address or phone number gets in.
/// </summary>
public sealed partial class A11yManualRecordTests
{
    private const string RecordPath = "docs/operations/a11y-manual-passes.md";

    private static readonly string[] RequiredSections =
    [
        "How to run the passes", "How to read a script", "Tools", "Results", "Sign-off",
    ];

    private static readonly string[] FlowTitles =
    [
        "Flow 1: Sign in with the emailed code",
        "Flow 2: Forgot password",
        "Flow 3: Create an order",
        "Flow 4: Record a payment",
        "Flow 5: Add an expense",
        "Flow 6: Get a Quote with photos on a phone",
        "Flow 7: Gallery and lightbox",
        "Flow 8: Quote inbox to order",
    ];

    private static readonly string[] ScriptColumns = ["Step", "Do", "NVDA should say", "VoiceOver should say"];

    private static readonly string[] ResultColumns = ["Flow", "Step", "Keyboard", "NVDA", "VoiceOver", "Outcome", "Date"];

    private static readonly string[] ValidResults = ["Pass", "Fail", "Not run"];

    private static readonly string[] ToolLines = ["NVDA version:", "Windows browser and version:", "iPhone model and iOS version:"];

    private static readonly string[] RunRules = ["CSPS_Dev", "live site", "TEST", "Spam", "audit", "preflight.ps1"];

    // Each detector paired with a sample it must catch, so a broken pattern cannot pass silently.
    private static readonly (Regex Pattern, string Sample)[] PrivateDetails =
    [
        (EmailAddress(), "someone@example.com"),
        (PhoneNumber(), "0917 123 4567"),
        (PhoneNumber(), "+63 917 123 4567"),
        (UserProfilePath(), "C:/Users/someone/project"),
        (UserProfilePath(), "C:\\Users\\someone\\project"),
    ];

    [Fact]
    public void HasTheFiveTopSections()
    {
        var text = ReadRecord();

        var missing = RequiredSections.Where(name => FindSection(text, name) is null).ToList();

        missing.ShouldBeEmpty("The record must keep these sections: How to run the passes, How to read a script, Tools, Results, Sign-off.");
    }

    [Fact]
    public void ScriptsAllEightFlows()
    {
        var text = ReadRecord();
        var problems = new List<string>();

        for (var index = 0; index < FlowTitles.Length; index++)
        {
            var title = FlowTitles[index];
            var section = FindSection(text, title);
            if (section is null)
            {
                problems.Add($"'{title}' has no section.");
                continue;
            }

            var table = ParseTable(section);
            if (string.Join(" | ", table.Header) != string.Join(" | ", ScriptColumns))
            {
                problems.Add($"'{title}' must have the script table: Step | Do | NVDA should say | VoiceOver should say.");
                continue;
            }

            if (table.Rows.Count < 3)
            {
                problems.Add($"'{title}' has {table.Rows.Count} steps; each flow needs at least 3.");
            }

            var stepIds = new HashSet<string>(StringComparer.Ordinal);
            foreach (var row in table.Rows)
            {
                if (row.Count != ScriptColumns.Length || row.Any(string.IsNullOrWhiteSpace))
                {
                    problems.Add($"'{title}' has a step row with a missing cell: {string.Join(" | ", row)}");
                    continue;
                }

                var id = row[0];
                if (!StepId(index + 1).IsMatch(id))
                {
                    problems.Add($"'{title}' has the step id '{id}'; ids read {index + 1}.1, {index + 1}.2 and so on.");
                }
                else if (!stepIds.Add(id))
                {
                    problems.Add($"'{title}' repeats the step id '{id}'.");
                }
            }
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void NoPlaceholderRemains()
    {
        ReadRecord().ShouldNotContain("To be scripted");
    }

    [Fact]
    public void ResultsHaveOneRowPerScriptStepInOrder()
    {
        var text = ReadRecord();
        var expected = FlowTitles
            .Select((title, index) => (Flow: $"Flow {index + 1}", Steps: ParseTable(FindSection(text, title) ?? []).Rows.Select(row => row[0])))
            .SelectMany(flow => flow.Steps.Select(step => $"{flow.Flow} {step}"))
            .ToList();

        var actual = ResultsRows().Select(row => $"{row[0]} {row[1]}").ToList();

        actual.ShouldBe(expected, "The Results table must have exactly one row for every script step, in script order.");
    }

    [Fact]
    public void Flow1CoversTheUpdateBannerAndTheOfflineScreen()
    {
        var flow = FlowText(1);

        foreach (var phrase in new[] { "A new version is available.", "Focus does not move", "You're offline", "Still no signal", "Try Again" })
        {
            flow.ShouldContain(phrase, Case.Insensitive);
        }
    }

    [Fact]
    public void Flow4And5SayHowTheTestDataIsRemoved()
    {
        FlowText(4).ShouldContain("TEST");
        FlowText(4).ShouldContain("Delete Order Permanently");
        FlowText(5).ShouldContain("TEST");
        FlowText(5).ShouldContain("Delete Permanently");
    }

    [Fact]
    public void Flow6IsWrittenForAPhone()
    {
        var flow = FlowText(6);

        flow.ShouldContain("swipe", Case.Insensitive);
        flow.ShouldContain("narrow", Case.Insensitive);
        flow.ShouldContain("Choose Photos");
        flow.ShouldContain("Send Inquiry");
    }

    [Fact]
    public void Flow7CoversThePhoneTapZonesAndEscape()
    {
        var flow = FlowText(7);

        flow.ShouldContain("Previous photo");
        flow.ShouldContain("Next photo");
        flow.ShouldContain("Escape");
        flow.ShouldContain("Gallery image viewer");
    }

    [Fact]
    public void Flow8CoversSpamAndTurnIntoOrder()
    {
        var flow = FlowText(8);

        flow.ShouldContain("Mark as Spam");
        flow.ShouldContain("Turn into Order");
        flow.ShouldContain("Change Status");
    }

    [Fact]
    public void ToolsNamesNvdaAsAHandRunToolWithVersionSlots()
    {
        var tools = FindSection(ReadRecord(), "Tools");

        tools.ShouldNotBeNull();
        var joined = string.Join('\n', tools);
        joined.ShouldContain("NVDA");
        joined.ShouldContain("separate");
        joined.ShouldContain("free");
        joined.ShouldContain("not a project dependency", Case.Insensitive);
        foreach (var line in ToolLines)
        {
            joined.ShouldContain(line);
        }
    }

    [Fact]
    public void HowToRunSaysWhereEachPassRunsAndHowTestDataIsHandled()
    {
        var section = FindSection(ReadRecord(), "How to run the passes");

        section.ShouldNotBeNull();
        var joined = string.Join('\n', section);
        var missing = RunRules.Where(rule => !joined.Contains(rule, StringComparison.Ordinal)).ToList();
        missing.ShouldBeEmpty("How to run the passes must cover: CSPS_Dev, the live site, TEST data, Spam, the audit log and the preflight.");
    }

    [Fact]
    public void ResultsRowsUseOnlyPassFailOrNotRun()
    {
        var problems = new List<string>();

        foreach (var row in ResultsRows())
        {
            var label = $"{row[0]} step {row[1]}";
            var marks = new[] { row[2], row[3], row[4] };
            foreach (var mark in marks)
            {
                if (!ValidResults.Contains(mark, StringComparer.Ordinal))
                {
                    problems.Add($"{label} has '{mark}'; use Pass, Fail or Not run.");
                }
            }

            var outcome = row[5];
            var date = row[6];
            if (marks.Contains("Fail", StringComparer.Ordinal) && string.IsNullOrWhiteSpace(outcome))
            {
                problems.Add($"{label} is a Fail without an outcome.");
            }

            var ran = marks.Any(mark => mark is "Pass" or "Fail");
            if (ran && !IsRealDate(date))
            {
                problems.Add($"{label} was run but has no yyyy-MM-dd date (got '{date}').");
            }

            if (!ran && !string.IsNullOrWhiteSpace(date))
            {
                problems.Add($"{label} is Not run everywhere but has a date ('{date}').");
            }
        }

        problems.ShouldBeEmpty();
    }

    [Fact]
    public void ResultsHaveTheAgreedColumns()
    {
        var table = ParseTable(FindSection(ReadRecord(), "Results") ?? []);

        string.Join(" | ", table.Header).ShouldBe(
            string.Join(" | ", ResultColumns), "The Results table columns must be: Flow | Step | Keyboard | NVDA | VoiceOver | Outcome | Date.");
        table.Rows.ShouldNotBeEmpty("The Results table has no rows.");
    }

    [Fact]
    public void SignedLineMatchesTheD22Format()
    {
        var lines = SignedLines(ReadRecord());

        lines.Count.ShouldBeLessThanOrEqualTo(1, "The record can hold only one Signed line.");
        foreach (var line in lines)
        {
            SignedLine().IsMatch(line).ShouldBeTrue($"The sign-off must read 'Signed: owner, yyyy-MM-dd' (got '{line}').");
            var real = DateOnly.TryParseExact(
                line[^10..], "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);
            real.ShouldBeTrue($"The sign-off date must be a real date (got '{line}').");
        }
    }

    [Fact]
    public void SignedLineFormatCatchesItsSamples()
    {
        SignedLine().IsMatch("Signed: owner, 2026-12-01").ShouldBeTrue();
        SignedLine().IsMatch("Signed: Jane, 2026-12-01").ShouldBeFalse();
        SignedLine().IsMatch("Signed: owner, 1 Dec 2026").ShouldBeFalse();
        SignedLine().IsMatch("Signed: owner, 2026-12-01 extra").ShouldBeFalse();
    }

    [Fact]
    public void ASignedRecordHasNoUnexplainedNotRun()
    {
        if (SignedLines(ReadRecord()).Count == 0)
        {
            return;
        }

        var unexplained = ResultsRows()
            .Where(row => row.Take(5).Skip(2).Contains("Not run", StringComparer.Ordinal) && string.IsNullOrWhiteSpace(row[5]))
            .Select(row => $"{row[0]} step {row[1]}")
            .ToList();

        unexplained.ShouldBeEmpty("A signed record cannot hold a Not run result unless its Outcome says why.");
    }

    [Fact]
    public void HoldsNoEmailAddressPhoneNumberOrLocalPath()
    {
        foreach (var (pattern, sample) in PrivateDetails)
        {
            pattern.IsMatch(sample).ShouldBeTrue($"Detector {pattern} must catch: {sample}");
        }

        var text = ReadRecord();
        var found = PrivateDetails
            .Select(detector => detector.Pattern)
            .Distinct()
            .SelectMany(pattern => pattern.Matches(text).Select(match => match.Value))
            .ToList();

        found.ShouldBeEmpty("The record must hold no email address, phone number or local user path.");
    }

    private static string ReadRecord()
    {
        var path = RepoRoot.PathOf(RecordPath);
        File.Exists(path).ShouldBeTrue($"{RecordPath} is missing.");
        return File.ReadAllText(path);
    }

    private static string FlowText(int flow)
    {
        var section = FindSection(ReadRecord(), FlowTitles[flow - 1]);
        section.ShouldNotBeNull($"Flow {flow} has no section.");
        return string.Join('\n', section);
    }

    private static List<List<string>> ResultsRows()
    {
        var table = ParseTable(FindSection(ReadRecord(), "Results") ?? []);
        var rows = table.Rows;
        rows.ShouldNotBeEmpty("The Results table has no rows.");
        rows.All(row => row.Count == ResultColumns.Length).ShouldBeTrue(
            $"Every Results row must have {ResultColumns.Length} cells.");
        return rows;
    }

    /// <summary>The lines under a "## heading" up to the next "## " heading, or null when the heading is missing.</summary>
    private static List<string>? FindSection(string text, string heading)
    {
        var lines = text.ReplaceLineEndings("\n").Split('\n');
        var start = Array.FindIndex(lines, line => string.Equals(line.TrimEnd(), $"## {heading}", StringComparison.Ordinal));
        return start < 0
            ? null
            : lines.Skip(start + 1).TakeWhile(line => !line.StartsWith("## ", StringComparison.Ordinal)).ToList();
    }

    private static (List<string> Header, List<List<string>> Rows) ParseTable(IEnumerable<string> section)
    {
        var tableLines = section
            .SkipWhile(line => !line.TrimStart().StartsWith('|'))
            .TakeWhile(line => line.TrimStart().StartsWith('|'))
            .ToList();
        if (tableLines.Count < 2 || !TableSeparator().IsMatch(tableLines[1]))
        {
            return ([], []);
        }

        return (Cells(tableLines[0]), tableLines.Skip(2).Select(Cells).ToList());
    }

    private static List<string> Cells(string line)
    {
        var trimmed = line.Trim();
        var inner = trimmed.Substring(1, trimmed.EndsWith('|') ? trimmed.Length - 2 : trimmed.Length - 1);
        return UnescapedPipe().Split(inner).Select(cell => cell.Trim()).ToList();
    }

    private static List<string> SignedLines(string text) =>
        text.ReplaceLineEndings("\n").Split('\n').Where(line => line.StartsWith("Signed:", StringComparison.Ordinal)).ToList();

    private static bool IsRealDate(string value) =>
        DateOnly.TryParseExact(value, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out _);

    private static Regex StepId(int flow) => new($@"^{flow}\.\d+$", RegexOptions.CultureInvariant);

    [GeneratedRegex(@"^Signed: owner, \d{4}-\d{2}-\d{2}$", RegexOptions.CultureInvariant)]
    private static partial Regex SignedLine();

    [GeneratedRegex(@"[A-Za-z0-9._%+\-]+@[A-Za-z0-9\-]+(\.[A-Za-z0-9\-]+)*\.[A-Za-z]{2,}", RegexOptions.CultureInvariant)]
    private static partial Regex EmailAddress();

    // A Philippine mobile number: 09xx or +63 9xx, with or without spaces and hyphens.
    [GeneratedRegex(@"(?<![\d\-])(?:\+?63|0)[\s\-]?9\d{2}[\s\-]?\d{3}[\s\-]?\d{4}(?![\d\-])", RegexOptions.CultureInvariant)]
    private static partial Regex PhoneNumber();

    [GeneratedRegex(@"[A-Za-z]:[\\/]+Users[\\/]", RegexOptions.CultureInvariant | RegexOptions.IgnoreCase)]
    private static partial Regex UserProfilePath();

    [GeneratedRegex(@"^\s*\|(\s*:?-{3,}:?\s*\|)+\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex TableSeparator();

    [GeneratedRegex(@"(?<!\\)\|", RegexOptions.CultureInvariant)]
    private static partial Regex UnescapedPipe();
}
