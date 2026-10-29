using System.Globalization;
using System.Text;

namespace Csps.LegacyFitCheck.Findings;

/// <summary>The facts of one run that the summary states in plain words. Counts only.</summary>
/// <param name="Orders">Orders checked.</param>
/// <param name="CompanyExpenses">Company expenses checked.</param>
/// <param name="Tables">Tables in the write evidence.</param>
/// <param name="Rows">Rows in the write evidence.</param>
/// <param name="UserUpdates">Index updates in the write evidence.</param>
/// <param name="ColumnsRead">Columns of the in-scope tables that were read.</param>
/// <param name="ColumnsUnknown">Columns that the draft mapping does not know.</param>
/// <param name="ColumnsMissing">Mapped columns the restore lacks.</param>
/// <param name="TrialRemoved">Whether the trial database was confirmed removed.</param>
internal sealed record SummaryFacts(
    int Orders,
    int CompanyExpenses,
    int Tables,
    long Rows,
    long UserUpdates,
    int ColumnsRead,
    int ColumnsUnknown,
    int ColumnsMissing,
    bool TrialRemoved);

/// <summary>
/// Renders the counts-only summary (D-02). It reads only the type, kind, rule key and list word of each finding and the legacy key
/// to count distinct records. It never reads a path, a message or a detail, because those can hold personal data. A list word is
/// printed only when it is on the allow-list.
/// </summary>
internal static class SummaryRenderer
{
    private const string ValueMark = "{value}";
    private const string ListValueStandIn = "(a list value)";

    private static readonly string[] Sections =
    [
        "Rule breaks",
        "Relaxations relied on",
        "Cannot map and not checked",
        "Unmatched lists and people",
        "Totals",
        "Trial import",
        "Company expenses",
        "Other notes",
    ];

    // Info findings the run facts already state.
    private static readonly HashSet<string> StatedAsFacts = new(StringComparer.Ordinal) { "write-evidence", "column.inventory", "trial.removed" };

    private static readonly Dictionary<string, string> Labels = new(StringComparer.Ordinal)
    {
        ["order.deleted"] = "Orders marked deleted, not imported",
        ["order.no-date"] = "Orders with no date",
        ["order.status-unknown"] = "Orders whose status has no CSPS status",
        ["order.no-number"] = "Orders with no order number (one is built)",
        ["order.no-status-history"] = "Orders with no status history (one row is written)",
        ["list.name-blank"] = "Orders with no order type word",
        ["list.name-too-long"] = "Order type word too long for a CSPS list name",
        ["list.product-type"] = "Product type '{value}' has no match",
        ["item.done-flag"] = "Items with a done flag (CSPS has none)",
        ["discount.giver"] = "Discounts that name who gave them (CSPS keeps no giver)",
        ["payment.deleted-dropped"] = "Deleted payments left out",
        ["payment.no-method"] = "Payments with no payment method",
        ["payment.payer-text-in-notes"] = "Payer text kept in the payment notes",
        ["order-expense.no-date"] = "Order expenses with no date, left out",
        ["order-expense.no-category"] = "Order expenses with no category (Others is used)",
        ["company-expense.no-category"] = "Company expenses with no category (Others is used)",
        ["person.blank"] = "Person text is empty",
        ["person.role-no-match"] = "Person is a legacy user whose role '{value}' has no CSPS staff match",
        ["person.unknown-name"] = "Person text matches no legacy user",
        ["person.legacy-holder"] = "The Legacy holder is used",
        ["dates.reading-differs"] = "Date differs between the as-stored and the Manila reading",
        ["column.unknown"] = "Columns the draft mapping does not know",
        ["column.missing"] = "Mapped columns missing from the restore",
        ["column.not-mapped"] = "Columns left for Phase 15 (not mapped)",
        ["totals.total"] = "Stored total differs from the CSPS total",
        ["totals.discount"] = "Stored discount differs from the CSPS discount",
        ["totals.paid"] = "Stored paid amount differs from the CSPS paid amount",
        ["totals.balance"] = "Stored balance differs from the CSPS balance",
        ["totals.expenses"] = "Stored expenses differ from the CSPS expenses",
        ["totals.no-stored-total"] = "Orders that store no total",
        ["totals.not-compared"] = "Orders whose stored totals were not compared",
        ["figures.not-judged"] = "Orders whose figure rules were not judged",
        ["trial.imported"] = "Imported into the trial database",
        ["trial.counter-lifted"] = "Order number counter lifted by the import",
        ["trial.number-taken"] = "Trial import refused: order number taken",
        ["trial.busy"] = "Trial import refused: busy",
        ["trial.invalid"] = "Trial import refused: a rule was broken",
        ["trial.exception"] = "Trial import threw an exception",
        ["KeepLegacyNumber"] = "Relies on keeping the order number built from the legacy id",
        ["DueDateOptional"] = "Relies on a missing due date",
        ["ContactNumberOptional"] = "Relies on a missing contact number",
        ["AllowAnyStatusHistory"] = "Relies on a status history the normal rules refuse",
        ["IgnoreAmountCaps"] = "Relies on amounts above the usual caps",
        ["AllowFutureDates"] = "Relies on dates in the future",
        ["AllowOverpaid"] = "Relies on payments over the balance",
        ["AllowCompletedWithBalance"] = "Relies on a completed order with a balance left",
        ["AllowDiscountAboveSubtotal"] = "Relies on a discount above the subtotal",
        ["IgnoreChildCaps"] = "Relies on more rows than the usual caps",
        ["AllowNoItems"] = "Relies on an order with no items",
        ["AllowRetiredListEntries"] = "Relies on retired list entries",
        ["AllowLegacyHolder"] = "Relies on the Legacy holder as a person",
        ["AllowInactivePeople"] = "Relies on inactive people",
    };

    private static readonly Dictionary<RecordKind, (string One, string Many)> Nouns = new()
    {
        [RecordKind.Run] = ("note", "notes"),
        [RecordKind.Column] = ("column", "columns"),
        [RecordKind.Order] = ("order", "orders"),
        [RecordKind.OrderItem] = ("item", "items"),
        [RecordKind.Payment] = ("payment", "payments"),
        [RecordKind.Discount] = ("discount", "discounts"),
        [RecordKind.OrderExpense] = ("order expense", "order expenses"),
        [RecordKind.CompanyExpense] = ("company expense", "company expenses"),
        [RecordKind.Person] = ("person", "people"),
        [RecordKind.ListValue] = ("list value", "list values"),
    };

    /// <summary>Gets the rule keys that have a plain-English label.</summary>
    internal static IReadOnlyCollection<string> LabelledKeys => Labels.Keys;

    /// <summary>Renders the summary.</summary>
    /// <param name="findings">Every finding of the run.</param>
    /// <param name="facts">The run facts.</param>
    /// <param name="allowedWords">The list words that may be printed.</param>
    /// <param name="created">The created and updated stamp.</param>
    /// <returns>The Markdown text.</returns>
    public static string Render(IEnumerable<Finding> findings, SummaryFacts facts, IReadOnlySet<string> allowedWords, DateTimeOffset created)
    {
        ArgumentNullException.ThrowIfNull(findings);
        ArgumentNullException.ThrowIfNull(facts);
        ArgumentNullException.ThrowIfNull(allowedWords);

        var stamp = created.ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);
        var lines = Group(findings, allowedWords).ToLookup(static line => line.Section, StringComparer.Ordinal);
        var text = new StringBuilder()
            .Append("# Legacy fit check: summary (counts only)\n")
            .Append(CultureInfo.InvariantCulture, $"*Created: {stamp} · Updated: {stamp}*\n")
            .Append('\n')
            .Append("Counts only. Safe to publish after the owner's review (07.1 D-02).\n")
            .Append('\n')
            .Append("## Run facts\n")
            .Append('\n');
        foreach (var fact in Facts(facts))
        {
            text.Append("- ").Append(fact).Append('\n');
        }

        foreach (var section in Sections)
        {
            text.Append('\n').Append("## ").Append(section).Append('\n').Append('\n');
            var sectionLines = lines[section].OrderBy(static line => line.Text, StringComparer.Ordinal).ToList();
            if (sectionLines.Count == 0)
            {
                text.Append("- None.\n");
            }

            foreach (var line in sectionLines)
            {
                text.Append("- ").Append(line.Text).Append('\n');
            }
        }

        return text
            .Append('\n')
            .Append("## Limits\n")
            .Append('\n')
            .Append("- Within one field only the first message shows.\n")
            .Append("- The figure rules of an order with a structural break are not judged.\n")
            .ToString();
    }

    private static IEnumerable<string> Facts(SummaryFacts facts)
    {
        yield return string.Create(CultureInfo.InvariantCulture, $"Orders checked: {facts.Orders}");
        yield return string.Create(CultureInfo.InvariantCulture, $"Company expenses checked: {facts.CompanyExpenses}");
        yield return string.Create(CultureInfo.InvariantCulture, $"Write evidence: unchanged ({facts.Tables} tables, {facts.Rows} rows, {facts.UserUpdates} index updates before and after)");
        yield return string.Create(CultureInfo.InvariantCulture, $"Column inventory: {facts.ColumnsRead} columns read, {facts.ColumnsUnknown} unknown, {facts.ColumnsMissing} missing");
        yield return $"Trial database removed: {(facts.TrialRemoved ? "yes" : "no")}";
    }

    private static IEnumerable<SummaryLine> Group(IEnumerable<Finding> findings, IReadOnlySet<string> allowedWords) =>
        findings
            .Where(static finding => !(finding.Type == FindingType.Info && StatedAsFacts.Contains(finding.RuleKey)))
            .GroupBy(finding => KeyOf(finding, allowedWords))
            .Select(group => new SummaryLine(SectionOf(group.Key.Type, group.Key.RuleKey), Line(group.Key, Count(group))));

    private static GroupKey KeyOf(Finding finding, IReadOnlySet<string> allowedWords)
    {
        var shows = Labels.TryGetValue(finding.RuleKey, out var label) && label.Contains(ValueMark, StringComparison.Ordinal);
        var value = !shows ? null : finding.ListValue is { } word && allowedWords.Contains(word.Trim()) ? word.Trim() : ListValueStandIn;
        return new GroupKey(finding.Type, finding.Kind, finding.RuleKey, value);
    }

    // A run note and a column are one finding each. Everything else counts the distinct legacy records.
    private static int Count(IGrouping<GroupKey, Finding> group) =>
        group.Key.Kind is RecordKind.Run or RecordKind.Column
            ? group.Count()
            : group.Select(static finding => finding.LegacyKey).Distinct(StringComparer.Ordinal).Count();

    private static string Line(GroupKey key, int count)
    {
        var label = Labels.TryGetValue(key.RuleKey, out var known) ? known : key.RuleKey;
        label = label.Replace(ValueMark, key.Value, StringComparison.Ordinal);
        var (one, many) = Nouns[key.Kind];
        return string.Create(CultureInfo.InvariantCulture, $"{label}: {count} {(count == 1 ? one : many)}");
    }

    private static string SectionOf(FindingType type, string ruleKey) => type switch
    {
        FindingType.RuleBreak => "Rule breaks",
        FindingType.ReliesOnRelaxation => "Relaxations relied on",
        FindingType.CannotMap or FindingType.NotChecked or FindingType.NotJudged => "Cannot map and not checked",
        FindingType.UnmatchedList or FindingType.UnmatchedPerson or FindingType.LegacyHolderUsed => "Unmatched lists and people",
        FindingType.TotalMismatch => "Totals",
        FindingType.TrialImport => "Trial import",
        FindingType.ExpenseRule => "Company expenses",
        _ => ruleKey.StartsWith("trial.", StringComparison.Ordinal) ? "Trial import" : "Other notes",
    };

    private sealed record GroupKey(FindingType Type, RecordKind Kind, string RuleKey, string? Value);

    private sealed record SummaryLine(string Section, string Text);
}
