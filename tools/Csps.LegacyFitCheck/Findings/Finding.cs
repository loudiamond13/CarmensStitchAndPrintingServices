namespace Csps.LegacyFitCheck.Findings;

/// <summary>What kind of problem a finding reports.</summary>
internal enum FindingType
{
    RuleBreak,
    ReliesOnRelaxation,
    NotJudged,
    CannotMap,
    NotChecked,
    UnmatchedList,
    UnmatchedPerson,
    LegacyHolderUsed,
    TotalMismatch,
    TrialImport,
    ExpenseRule,
    Info,
}

/// <summary>Which kind of legacy record a finding is about.</summary>
internal enum RecordKind
{
    Run,
    Column,
    Order,
    OrderItem,
    Payment,
    Discount,
    OrderExpense,
    CompanyExpense,
    Person,
    ListValue,
}

/// <summary>One thing the check found. Everything but the type and kind may hold personal data, so a finding goes to _local only.</summary>
/// <param name="Kind">The kind of record.</param>
/// <param name="LegacyKey">The legacy table and id, such as <c>Orders:12</c>.</param>
/// <param name="Type">The kind of finding.</param>
/// <param name="RuleKey">The rule or topic it belongs to.</param>
/// <param name="Path">The field path, when there is one.</param>
/// <param name="Message">What is wrong, in plain words.</param>
/// <param name="ListValue">The legacy list value involved, when there is one.</param>
/// <param name="Detail">Anything else worth knowing.</param>
internal sealed record Finding(
    RecordKind Kind,
    string LegacyKey,
    FindingType Type,
    string RuleKey,
    string? Path,
    string? Message,
    string? ListValue,
    string? Detail);
