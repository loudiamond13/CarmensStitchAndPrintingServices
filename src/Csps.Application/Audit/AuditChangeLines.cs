using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Users;
using Csps.Domain.Auditing;

namespace Csps.Application.Audit;

/// <summary>One "What changed" line of an expense or category entry (D-27). Text fields carry no text, only the fact that they changed.</summary>
/// <param name="Field">One of <c>amount</c>, <c>date</c>, <c>category</c>, <c>payer</c>, <c>description</c>, <c>notes</c>, <c>name</c> or <c>tone</c>.</param>
/// <param name="From">The old value (an amount as <c>0.00</c>, a date as <c>yyyy-MM-dd</c>, a category name, a tone); null when there is none.</param>
/// <param name="To">The new value; null when there is none or the field is a text field.</param>
/// <param name="FromPerson">For <c>payer</c>: the old payer.</param>
/// <param name="ToPerson">For <c>payer</c>: the new payer.</param>
public sealed record AuditChangeLine(string Field, string? From, string? To, ActorRef? FromPerson, ActorRef? ToPerson);

/// <summary>The facts of an expense as an entry saw it: added, deleted, restored or permanently deleted.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="Category">The category's current name; null when the category is gone.</param>
/// <param name="Amount">The amount.</param>
/// <param name="Payer">The payer.</param>
public sealed record AuditExpenseSnapshot(DateOnly Date, string? Category, decimal Amount, ActorRef? Payer);

/// <summary>A change line before its ids are resolved: category and payer values are dashed GUID text.</summary>
/// <param name="Field">The field name.</param>
/// <param name="From">The old value.</param>
/// <param name="To">The new value.</param>
public sealed record ParsedAuditChange(string Field, string? From, string? To);

/// <summary>A snapshot before its ids are resolved.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="CategoryId">The category id; null when the detail held none.</param>
/// <param name="Amount">The amount.</param>
/// <param name="PayerId">The payer id; null when the detail held none.</param>
public sealed record ParsedAuditSnapshot(DateOnly Date, Guid? CategoryId, decimal Amount, Guid? PayerId);

/// <summary>What the stored detail of an expense or category entry says, with ids still unresolved.</summary>
/// <param name="Lines">The change lines.</param>
/// <param name="Snapshot">The snapshot; null when the entry has none.</param>
/// <param name="PayerId">The person the entry is done to: the payer, or the new payer for a payer change; null when none.</param>
public sealed record ParsedAuditChanges(IReadOnlyList<ParsedAuditChange> Lines, ParsedAuditSnapshot? Snapshot, Guid? PayerId)
{
    /// <summary>An entry with nothing to show.</summary>
    public static ParsedAuditChanges None { get; } = new([], null, null);

    /// <summary>The category ids the lines and the snapshot name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> CategoryIds()
    {
        foreach (var line in Lines.Where(line => line.Field == AuditChangeLines.CategoryField))
        {
            foreach (var value in new[] { line.From, line.To })
            {
                if (AuditChangeLines.TryReadId(value, out var id))
                {
                    yield return id;
                }
            }
        }

        if (Snapshot?.CategoryId is { } snapshotCategory)
        {
            yield return snapshotCategory;
        }
    }

    /// <summary>The people ids the lines, the snapshot and Done to name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> PersonIds()
    {
        foreach (var line in Lines.Where(line => line.Field == AuditChangeLines.PayerField))
        {
            foreach (var value in new[] { line.From, line.To })
            {
                if (AuditChangeLines.TryReadId(value, out var id))
                {
                    yield return id;
                }
            }
        }

        if (Snapshot?.PayerId is { } snapshotPayer)
        {
            yield return snapshotPayer;
        }

        if (PayerId is { } payer)
        {
            yield return payer;
        }
    }
}

/// <summary>
/// Reads the stored detail of expense and category entries into typed lines (D-27, 05 D-40). Only known keys are read and each value
/// must have the shape the writer gives it, so no free text of an expense and no raw detail can pass through. The only free text read
/// is a category name, which is not personal data (D-12).
/// </summary>
public static class AuditChangeLines
{
    internal const string CategoryField = "category";
    internal const string PayerField = "payer";

    private const string AmountField = "amount";
    private const string DateField = "date";
    private const string NameField = "name";
    private const string ToneField = "tone";
    private const string FieldsKey = "fields";
    private const string DateFormat = "yyyy-MM-dd";
    private static readonly string[] TextFields = ["description", "notes"];

    /// <summary>Parses the detail of an entry.</summary>
    /// <param name="action">The action code.</param>
    /// <param name="detail">The stored detail.</param>
    /// <returns>The lines, snapshot and payer; nothing for any other action.</returns>
    public static ParsedAuditChanges For(string action, string? detail)
    {
        ArgumentNullException.ThrowIfNull(action);

        if (string.IsNullOrEmpty(detail))
        {
            return ParsedAuditChanges.None;
        }

        return action switch
        {
            AuditActions.CompanyExpenseAdded
                or AuditActions.CompanyExpenseDeleted
                or AuditActions.CompanyExpenseRestored
                or AuditActions.CompanyExpensePermanentlyDeleted => ReadSnapshot(detail),
            AuditActions.CompanyExpenseChanged => ReadEdit(detail),
            AuditActions.CompanyExpensePayerChanged => ReadPayerChange(detail),
            AuditActions.ExpenseCategoryAdded
                or AuditActions.ExpenseCategoryRenamed
                or AuditActions.ExpenseCategoryRecolored
                or AuditActions.ExpenseCategoryRetired
                or AuditActions.ExpenseCategoryReactivated
                or AuditActions.ExpenseCategoryDeleted => ReadCategory(detail),
            _ => ParsedAuditChanges.None,
        };
    }

    /// <summary>Resolves the ids of parsed changes to names and people.</summary>
    /// <param name="parsed">The parsed detail.</param>
    /// <param name="categories">Current category names by id; a missing id means the category is gone.</param>
    /// <param name="person">Looks a person up by id.</param>
    /// <returns>The lines and the snapshot.</returns>
    public static (IReadOnlyList<AuditChangeLine> Lines, AuditExpenseSnapshot? Snapshot) Resolve(
        ParsedAuditChanges parsed, IReadOnlyDictionary<Guid, string> categories, Func<Guid?, ActorRef?> person)
    {
        ArgumentNullException.ThrowIfNull(parsed);
        ArgumentNullException.ThrowIfNull(categories);
        ArgumentNullException.ThrowIfNull(person);

        string? CategoryName(string? id) =>
            TryReadId(id, out var key) && categories.TryGetValue(key, out var name) ? name : null;

        Guid? IdOf(string? id) => TryReadId(id, out var key) ? key : null;

        IReadOnlyList<AuditChangeLine> lines =
        [
            .. parsed.Lines.Select(line => line.Field switch
            {
                CategoryField => new AuditChangeLine(line.Field, CategoryName(line.From), CategoryName(line.To), null, null),
                PayerField => new AuditChangeLine(line.Field, null, null, person(IdOf(line.From)), person(IdOf(line.To))),
                _ => new AuditChangeLine(line.Field, line.From, line.To, null, null),
            }),
        ];

        var snapshot = parsed.Snapshot is { } facts
            ? new AuditExpenseSnapshot(
                facts.Date,
                facts.CategoryId is { } categoryId && categories.TryGetValue(categoryId, out var name) ? name : null,
                facts.Amount,
                person(facts.PayerId))
            : null;
        return (lines, snapshot);
    }

    internal static bool TryReadId(string? text, out Guid id) => Guid.TryParseExact(text, "D", out id);

    // date=…;category=<id>;amount=…;payer=<id>
    private static ParsedAuditChanges ReadSnapshot(string detail)
    {
        string? date = null;
        string? category = null;
        string? amount = null;
        string? payer = null;
        foreach (var part in AuditDetailFormat.Parse(detail).Where(part => part.From is null))
        {
            switch (part.Key)
            {
                case DateField:
                    date = part.To;
                    break;
                case CategoryField:
                    category = part.To;
                    break;
                case AmountField:
                    amount = part.To;
                    break;
                case PayerField:
                    payer = part.To;
                    break;
                default:
                    break;
            }
        }

        Guid? payerId = TryReadId(payer, out var payerKey) ? payerKey : null;
        ParsedAuditSnapshot? snapshot = TryReadDate(date, out var day) && TryReadAmount(amount, out var money)
            ? new ParsedAuditSnapshot(day, TryReadId(category, out var categoryKey) ? categoryKey : null, money, payerId)
            : null;
        return Build([], snapshot, payerId);
    }

    // amount, date and category as old>new, fields=description,notes, then payer=<current payer>
    private static ParsedAuditChanges ReadEdit(string detail)
    {
        List<ParsedAuditChange> lines = [];
        Guid? payerId = null;
        foreach (var part in AuditDetailFormat.Parse(detail))
        {
            switch (part.Key)
            {
                case AmountField when part.From is not null && TryReadAmount(part.From, out _) && TryReadAmount(part.To, out _):
                case DateField when part.From is not null && TryReadDate(part.From, out _) && TryReadDate(part.To, out _):
                    lines.Add(new ParsedAuditChange(part.Key, part.From, part.To));
                    break;
                case CategoryField when part.From is not null && TryReadId(part.From, out var from) && TryReadId(part.To, out var to):
                    lines.Add(new ParsedAuditChange(part.Key, from.ToString("D"), to.ToString("D")));
                    break;
                case FieldsKey when part.From is null:
                    foreach (var field in part.To.Split(',').Where(field => TextFields.Contains(field)).Distinct())
                    {
                        lines.Add(new ParsedAuditChange(field, null, null));
                    }

                    break;
                case PayerField when part.From is null && TryReadId(part.To, out var current):
                    payerId = current;
                    break;
                default:
                    break;
            }
        }

        return Build(lines, null, payerId);
    }

    // payer=<old id>><new id>
    private static ParsedAuditChanges ReadPayerChange(string detail)
    {
        var part = AuditDetailFormat.Parse(detail).FirstOrDefault(part => part.Key == PayerField && part.From is not null);
        return part is not null && TryReadId(part.From, out var from) && TryReadId(part.To, out var to)
            ? Build([new ParsedAuditChange(PayerField, from.ToString("D"), to.ToString("D"))], null, to)
            : ParsedAuditChanges.None;
    }

    // name=<name>, name=<old>><new>, tone=<tone> or tone=<old>><new>
    private static ParsedAuditChanges ReadCategory(string detail)
    {
        List<ParsedAuditChange> lines =
        [
            .. AuditDetailFormat.Parse(detail)
                .Where(part => part.Key is NameField or ToneField)
                .Select(part => new ParsedAuditChange(part.Key, part.From, part.To)),
        ];
        return Build(lines, null, null);
    }

    private static ParsedAuditChanges Build(List<ParsedAuditChange> lines, ParsedAuditSnapshot? snapshot, Guid? payerId) =>
        lines.Count == 0 && snapshot is null && payerId is null ? ParsedAuditChanges.None : new ParsedAuditChanges(lines, snapshot, payerId);

    private static bool TryReadDate(string? text, out DateOnly date) =>
        DateOnly.TryParseExact(text, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static bool TryReadAmount(string? text, out decimal amount) =>
        decimal.TryParse(text, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out amount);
}
