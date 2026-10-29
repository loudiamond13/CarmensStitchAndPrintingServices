using System.Text.RegularExpressions;
using Csps.LegacyFitCheck.Findings;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

/// <summary>The _local path guard, the privacy self-check and the summary renderer (07.1 D-01, D-02). Temp folders and made-up values only.</summary>
public sealed partial class FindingsTests : IDisposable
{
    private const string Sentinel = "SENTINEL-NAME-7Q";

    private readonly string _temp = Path.Combine(Path.GetTempPath(), $"csps-findings-{Guid.NewGuid():N}");

    public FindingsTests() => Directory.CreateDirectory(_temp);

    private readonly List<string> _links = [];

    public void Dispose()
    {
        // A link is removed by itself first, so the recursive delete never walks through it.
        foreach (var link in _links.Where(static link => new DirectoryInfo(link).Exists))
        {
            Directory.Delete(link, recursive: false);
        }

        if (Directory.Exists(_temp))
        {
            Directory.Delete(_temp, recursive: true);
        }
    }

    [Fact]
    public async Task ARootNotNamedLocalIsRefused()
    {
        var token = TestContext.Current.CancellationToken;

        foreach (var name in new[] { "other", "_localx", "x_local", "_local.bak" })
        {
            await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(Path.Combine(_temp, name), [], Time(), token));
            Directory.Exists(Path.Combine(_temp, name)).ShouldBeFalse();
        }
    }

    [Fact]
    public async Task ARootThatResolvesToAnotherNameThroughDotDotIsRefused()
    {
        var token = TestContext.Current.CancellationToken;
        var root = Path.Combine(_temp, "_local", "..", "other");

        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(root, [], Time(), token));
    }

    [Fact]
    public async Task ARootWithATrailingSeparatorOrAnotherLetterCaseIsAccepted()
    {
        var token = TestContext.Current.CancellationToken;

        var path = await FindingsWriter.WriteAsync(Path.Combine(_temp, "_local") + Path.DirectorySeparatorChar, [], Time(), token);
        path.ShouldStartWith("_local/legacy-fit-check/findings-");

        var other = await FindingsWriter.WriteAsync(Path.Combine(_temp, "again", "_LOCAL"), [], Time(), token);
        other.ShouldStartWith("_local/legacy-fit-check/findings-");
    }

    [Theory]
    [InlineData("legacy-fit-check", "..\\x.md")]
    [InlineData("legacy-fit-check", "..\\..\\evil.md")]
    [InlineData("legacy-fit-check", "../../../evil.md")]
    [InlineData("..\\..\\_localx", "x.md")]
    [InlineData("..", "x.md")]
    [InlineData("legacy-fit-check", "sub\\..\\..\\x.md")]
    public void ATargetThatLeavesTheFolderIsRefused(string subFolder, string fileName)
    {
        var root = Path.Combine(_temp, "_local");

        Should.Throw<InvalidOperationException>(() => FindingsWriter.ResolveTarget(root, subFolder, fileName));
    }

    [Fact]
    public void AnAbsoluteTargetOutsideTheFolderIsRefused()
    {
        var root = Path.Combine(_temp, "_local");
        var outside = Path.Combine(_temp, "outside", "evil.md");

        Should.Throw<InvalidOperationException>(() => FindingsWriter.ResolveTarget(root, "legacy-fit-check", outside));
        Should.Throw<InvalidOperationException>(() => FindingsWriter.ResolveTarget(root, Path.Combine(_temp, "outside"), "evil.md"));
    }

    [Fact]
    public void ASiblingFolderWithTheSamePrefixIsRefused()
    {
        var root = Path.Combine(_temp, "_local");

        Should.Throw<InvalidOperationException>(() => FindingsWriter.ResolveTarget(root, "..\\_localx", "x.md"));
        FindingsWriter.ResolveTarget(root, "legacy-fit-check", "findings-1.md").ShouldStartWith(Path.Combine(root, "legacy-fit-check") + Path.DirectorySeparatorChar);
    }

    [Fact]
    public async Task AFindingsFolderThatIsALinkIsRefusedAndNothingIsWrittenThroughIt()
    {
        var token = TestContext.Current.CancellationToken;
        var root = Path.Combine(_temp, "_local");
        var elsewhere = Path.Combine(_temp, "elsewhere");
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(elsewhere);
        CreateDirectoryLinkOrSkip(Path.Combine(root, "legacy-fit-check"), elsewhere);

        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(root, [], Time(), token));
        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteSummaryAsync(root, "x", Time(), token));
        Directory.EnumerateFileSystemEntries(elsewhere).ShouldBeEmpty();
    }

    [Fact]
    public async Task ARootThatIsALinkIsRefusedAndNothingIsWrittenThroughIt()
    {
        var token = TestContext.Current.CancellationToken;
        var elsewhere = Path.Combine(_temp, "elsewhere");
        Directory.CreateDirectory(elsewhere);
        CreateDirectoryLinkOrSkip(Path.Combine(_temp, "_local"), elsewhere);

        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(Path.Combine(_temp, "_local"), [], Time(), token));
        Directory.EnumerateFileSystemEntries(elsewhere).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFindingsFileThatIsALinkIsRefusedAndItsTargetIsLeftAlone()
    {
        var token = TestContext.Current.CancellationToken;
        var root = Path.Combine(_temp, "_local");
        var folder = Path.Combine(root, "legacy-fit-check");
        Directory.CreateDirectory(folder);
        var outside = Path.Combine(_temp, "outside.md");
        await File.WriteAllTextAsync(outside, "keep", token);
        var time = Time();
        var stamp = time.GetUtcNow().ToString("yyyyMMdd-HHmmss", System.Globalization.CultureInfo.InvariantCulture);
        try
        {
            File.CreateSymbolicLink(Path.Combine(folder, $"findings-{stamp}.md"), outside);
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            Assert.Skip("This account may not create file symbolic links, so the file link case could not run.");
        }

        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(root, [], time, token));
        (await File.ReadAllTextAsync(outside, token)).ShouldBe("keep");
    }

    [Fact]
    public async Task AnExistingFileWithTheSameStampIsNotOverwritten()
    {
        var token = TestContext.Current.CancellationToken;
        var root = Path.Combine(_temp, "_local");
        var time = Time();

        var first = await FindingsWriter.WriteAsync(root, [], time, token);
        var firstPath = Path.Combine(_temp, first.Replace('/', Path.DirectorySeparatorChar));
        var before = await File.ReadAllTextAsync(firstPath, token);

        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteAsync(root, [new Finding(RecordKind.Run, "Run", FindingType.Info, "x", null, "later", null, null)], time, token));
        (await File.ReadAllTextAsync(firstPath, token)).ShouldBe(before);

        var summary = await FindingsWriter.WriteSummaryAsync(root, "one", time, token);
        await Should.ThrowAsync<InvalidOperationException>(() => FindingsWriter.WriteSummaryAsync(root, "two", time, token));
        (await File.ReadAllTextAsync(Path.Combine(_temp, summary.Replace('/', Path.DirectorySeparatorChar)), token)).ShouldBe("one");
    }

    [Fact]
    public void ASummaryHoldingAReadValueInAnotherLetterCaseIsRefused()
    {
        PrivacySelfCheck.Check("Orders: sentinel-name-7q appears", [Sentinel], []).ShouldBe(PrivacyVerdict.HeldPersonalValue);
        PrivacySelfCheck.Check("Orders: SENTINEL-name-7Q appears", ["  sentinel-NAME-7q  "], []).ShouldBe(PrivacyVerdict.HeldPersonalValue);
    }

    [Fact]
    public void AReadValueOfTwoCharactersNeverRefuses()
    {
        PrivacySelfCheck.Check("ab ab ab", ["ab", " ab ", "a", string.Empty, null], []).ShouldBe(PrivacyVerdict.Clean);
        PrivacySelfCheck.Check("abc", ["abc"], []).ShouldBe(PrivacyVerdict.HeldPersonalValue);
    }

    [Fact]
    public void AnAllowedListWordThatIsAlsoAReadValueDoesNotRefuse()
    {
        PrivacySelfCheck.Check("Product type 'Polo Shirt' has no match: 2 items", ["Polo Shirt"], ["polo shirt"]).ShouldBe(PrivacyVerdict.Clean);
        PrivacySelfCheck.Check("Product type 'Polo Shirt' has no match: 2 items", ["Polo Shirt", Sentinel], ["Polo Shirt"]).ShouldBe(PrivacyVerdict.Clean);
        PrivacySelfCheck.Check($"Polo Shirt {Sentinel}", ["Polo Shirt", Sentinel], ["Polo Shirt"]).ShouldBe(PrivacyVerdict.HeldPersonalValue);
    }

    [Fact]
    public void NumbersAloneInTheSummaryNeverRefuse()
    {
        PrivacySelfCheck.Check("Payments with no payment method: 155 payments", [Sentinel, "SENTINEL-DESC-7Q", "ORD-2025-0001"], []).ShouldBe(PrivacyVerdict.Clean);
        PrivacySelfCheck.Check("155 payments", ["12"], []).ShouldBe(PrivacyVerdict.Clean);
    }

    [Fact]
    public void TheSameFindingsRenderTheSameTextTwice()
    {
        Finding[] findings = [.. Every(), Make("list.product-type", FindingType.UnmatchedList, RecordKind.OrderItem, "OrderItems:1", "Fixture Garments")];

        Render(findings).ShouldBe(Render(findings));
        Render(findings).ShouldBe(Render([.. findings.Reverse()]));
    }

    [Fact]
    public void EveryLabelLineHasACountAndANoun()
    {
        var text = Render(Every());
        var lines = text.Split('\n').Where(static line => line.StartsWith("- ", StringComparison.Ordinal)).ToList();

        lines.ShouldNotBeEmpty();
        var groupLines = lines.Where(static line => !line.StartsWith("- None.", StringComparison.Ordinal) && !line.Contains("checked:", StringComparison.Ordinal)
            && !line.StartsWith("- Write evidence", StringComparison.Ordinal) && !line.StartsWith("- Column inventory", StringComparison.Ordinal)
            && !line.StartsWith("- Trial database removed", StringComparison.Ordinal) && !line.StartsWith("- Within one field", StringComparison.Ordinal)
            && !line.StartsWith("- The figure rules", StringComparison.Ordinal)).ToList();
        groupLines.Count.ShouldBe(SummaryRenderer.LabelledKeys.Count);
        groupLines.ShouldAllBe(static line => CountedLine().IsMatch(line));
    }

    [Fact]
    public void TheRendererNeverPrintsAPathMessageDetailOrKey()
    {
        var findings = SummaryRenderer.LabelledKeys
            .Select(key => new Finding(RecordKind.Order, "Orders:" + Sentinel, FindingType.CannotMap, key, "path-" + Sentinel, "message-" + Sentinel, null, "detail-" + Sentinel))
            .ToList();

        var text = Render(findings);

        text.ShouldNotContain("SENTINEL", Case.Insensitive);
        text.ShouldNotContain("Orders:");
    }

    [Fact]
    public void AListWordIsPrintedOnlyWhenItIsAllowed()
    {
        Finding[] findings =
        [
            Make("list.product-type", FindingType.UnmatchedList, RecordKind.OrderItem, "OrderItems:1", "Fixture Garments"),
            Make("list.product-type", FindingType.UnmatchedList, RecordKind.OrderItem, "OrderItems:2", "fixture garments"),
            Make("list.product-type", FindingType.UnmatchedList, RecordKind.OrderItem, "OrderItems:3", "Jane Doe Sentinel"),
            Make("list.product-type", FindingType.UnmatchedList, RecordKind.OrderItem, "OrderItems:4", "Other Hidden Word"),
            Make("person.unknown-name", FindingType.UnmatchedPerson, RecordKind.Payment, "Payments:1", "Some Person"),
            Make("person.unknown-name", FindingType.UnmatchedPerson, RecordKind.Payment, "Payments:2", "Another Person"),
            Make("person.role-no-match", FindingType.UnmatchedPerson, RecordKind.Payment, "Payments:3", "Employee"),
        ];

        var text = Render(findings, ["Fixture Garments", "Employee"]);

        text.ShouldContain("Product type 'Fixture Garments' has no match: 1 item");
        text.ShouldContain("Product type 'fixture garments' has no match: 1 item");
        text.ShouldContain("Product type '(a list value)' has no match: 2 items");
        text.ShouldContain("Person text matches no legacy user: 2 payments");
        text.ShouldContain("Person is a legacy user whose role 'Employee' has no CSPS staff match: 1 payment");
        text.ShouldNotContain("Jane Doe");
        text.ShouldNotContain("Hidden");
        text.ShouldNotContain("Some Person");
    }

    [Fact]
    public void RecordsAreCountedOnceNoMatterHowManyFindingsTheyHave()
    {
        Finding[] findings =
        [
            Make("payment.no-method", FindingType.CannotMap, RecordKind.Payment, "Payments:1", null),
            Make("payment.no-method", FindingType.CannotMap, RecordKind.Payment, "Payments:1", null),
            Make("payment.no-method", FindingType.CannotMap, RecordKind.Payment, "Payments:2", null),
            Make("order.no-number", FindingType.CannotMap, RecordKind.Order, "Orders:7", null),
            Make("some.unknown-rule", FindingType.RuleBreak, RecordKind.Order, "Orders:7", null),
            Make("some.unknown-rule", FindingType.RuleBreak, RecordKind.Order, "Orders:8", null),
        ];

        var text = Render(findings);

        text.ShouldContain("Payments with no payment method: 2 payments");
        text.ShouldContain("Orders with no order number (one is built): 1 order");
        text.ShouldContain("some.unknown-rule: 2 orders");
    }

    [Fact]
    public void ColumnsLeftForPhase15AreNotMixedWithColumnsThatHaveNoPlace()
    {
        Finding[] findings =
        [
            Make("column.not-mapped", FindingType.NotChecked, RecordKind.Column, "Orders", null),
            Make("column.not-mapped", FindingType.NotChecked, RecordKind.Column, "Payments", null),
            Make("column.not-mapped", FindingType.CannotMap, RecordKind.Column, "OrderItems", null),
        ];

        var lines = Render(findings).Split('\n').Where(static line => line.Contains("column", StringComparison.Ordinal) && line.StartsWith("- ", StringComparison.Ordinal)).ToList();

        lines.Count.ShouldBe(3);
        lines.Distinct().Count().ShouldBe(lines.Count);
        lines.ShouldContain("- Columns left for Phase 15 (not checked): 2 columns");
        lines.ShouldContain("- Columns with no place in CSPS (cannot map): 1 column");
    }

    [Fact]
    public void AKeyEndingInAFullStopDoesNotDoubleUpWithTheColon()
    {
        Finding[] findings = [Make("PaidByUserId: Choose someone else.", FindingType.ExpenseRule, RecordKind.CompanyExpense, "Expenses:1", null)];

        Render(findings).ShouldContain("- PaidByUserId: Choose someone else: 1 company expense");
    }

    [Fact]
    public void UnplacedExpensesGetTheirOwnCountedLine()
    {
        Finding[] findings =
        [
            Make("expense.unplaced", FindingType.CannotMap, RecordKind.UnplacedExpense, "Expenses:3", null),
            Make("expense.unplaced", FindingType.CannotMap, RecordKind.UnplacedExpense, "Expenses:4", null),
        ];

        Render(findings).ShouldContain("Expenses with no order and not marked as company expenses (counted only, not judged): 2 expenses");
        Render([findings[0]]).ShouldContain("(counted only, not judged): 1 expense");
    }

    [Fact]
    public void ExpensesLinkedToAMissingOrderGetTheirOwnCountedLine()
    {
        Finding[] findings =
        [
            Make("expense.order-missing", FindingType.CannotMap, RecordKind.OrderMissingExpense, "Expenses:3", null),
            Make("expense.order-missing", FindingType.CannotMap, RecordKind.OrderMissingExpense, "Expenses:4", null),
            Make("expense.unplaced", FindingType.CannotMap, RecordKind.UnplacedExpense, "Expenses:5", null),
        ];

        var text = Render(findings);

        text.ShouldContain("- Expenses linked to an order that is not in the old data (counted only, not judged): 2 expenses");
        text.ShouldContain("- Expenses with no order and not marked as company expenses (counted only, not judged): 1 expense");
        Render([findings[0]]).ShouldContain("not in the old data (counted only, not judged): 1 expense");
    }

    [Fact]
    public void TheSectionsAppearInTheAgreedOrderWithTheClosingLimits()
    {
        var text = Render(Every());
        string[] headings =
        [
            "## Run facts",
            "## Rule breaks",
            "## Relaxations relied on",
            "## Cannot map and not checked",
            "## Unmatched lists and people",
            "## Totals",
            "## Trial import",
            "## Company expenses",
            "## Other notes",
            "## Limits",
        ];

        var positions = headings.Select(heading => text.IndexOf(heading, StringComparison.Ordinal)).ToList();

        positions.ShouldAllBe(static position => position >= 0);
        positions.ShouldBe([.. positions.Order()]);
        text.Split('\n')[1].ShouldStartWith("*Created: ");
        text.ShouldContain("Counts only. Safe to publish after the owner's review (07.1 D-02).");
        text.ShouldContain("Trial database removed: yes");
    }

    private static string Render(IEnumerable<Finding> findings, params string[] allowed) =>
        SummaryRenderer.Render(findings, new SummaryFacts(2, 1, 10, 5, 0, 30, 0, 0, TrialRemoved: true), new HashSet<string>(allowed, StringComparer.OrdinalIgnoreCase), new DateTimeOffset(2026, 10, 29, 9, 0, 0, TimeSpan.FromHours(-5)));

    // One finding per label key, with a type that lands in a different section for each group of keys.
    private static IEnumerable<Finding> Every() =>
        SummaryRenderer.LabelledKeys.Select(static key => Make(key, TypeFor(key), KindFor(key), "Row:1", null));

    private static FindingType TypeFor(string key) => key switch
    {
        _ when key.StartsWith("totals.", StringComparison.Ordinal) && key != "totals.no-stored-total" && key != "totals.not-compared" => FindingType.TotalMismatch,
        _ when key.StartsWith("trial.", StringComparison.Ordinal) => FindingType.Info,
        _ when key.StartsWith("person.", StringComparison.Ordinal) => FindingType.UnmatchedPerson,
        "list.product-type" => FindingType.UnmatchedList,
        _ when key.Contains('.', StringComparison.Ordinal) => FindingType.CannotMap,
        _ => FindingType.ReliesOnRelaxation,
    };

    private static RecordKind KindFor(string key) => key switch
    {
        _ when key.StartsWith("payment.", StringComparison.Ordinal) => RecordKind.Payment,
        _ when key.StartsWith("column.", StringComparison.Ordinal) => RecordKind.Column,
        _ when key.StartsWith("company-expense.", StringComparison.Ordinal) => RecordKind.CompanyExpense,
        "expense.unplaced" => RecordKind.UnplacedExpense,
        "expense.order-missing" => RecordKind.OrderMissingExpense,
        _ when key.StartsWith("order-expense.", StringComparison.Ordinal) => RecordKind.OrderExpense,
        _ when key.StartsWith("item.", StringComparison.Ordinal) || key == "list.product-type" => RecordKind.OrderItem,
        _ when key.StartsWith("discount.", StringComparison.Ordinal) => RecordKind.Discount,
        _ when key.StartsWith("trial.", StringComparison.Ordinal) => RecordKind.Run,
        _ => RecordKind.Order,
    };

    private static Finding Make(string rule, FindingType type, RecordKind kind, string key, string? listValue) =>
        new(kind, key, type, rule, null, "message", listValue, null);

    private static FakeTimeProvider Time() => new(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));

    // A symbolic link needs a privilege some accounts lack. A junction does not, and it is also a reparse point.
    private void CreateDirectoryLinkOrSkip(string link, string target)
    {
        _links.Add(link);
        try
        {
            Directory.CreateSymbolicLink(link, target);
            return;
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or PlatformNotSupportedException)
        {
            // Fall through to the junction.
        }

        if (!OperatingSystem.IsWindows() || !TryCreateJunction(link, target))
        {
            Assert.Skip("This account may not create directory links, so the folder link case could not run.");
        }
    }

    private static bool TryCreateJunction(string link, string target)
    {
        var start = new System.Diagnostics.ProcessStartInfo("cmd.exe") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add("/c");
        start.ArgumentList.Add("mklink");
        start.ArgumentList.Add("/J");
        start.ArgumentList.Add(link);
        start.ArgumentList.Add(target);
        using var process = System.Diagnostics.Process.Start(start);
        if (process is null)
        {
            return false;
        }

        process.StandardInput.Close();
        process.StandardOutput.ReadToEnd();
        process.StandardError.ReadToEnd();
        process.WaitForExit();
        return process.ExitCode == 0 && new DirectoryInfo(link).Attributes.HasFlag(FileAttributes.ReparsePoint);
    }

    [GeneratedRegex(@"^- .+: \d+ [a-z]+( [a-z]+)?$", RegexOptions.CultureInvariant)]
    private static partial Regex CountedLine();
}
