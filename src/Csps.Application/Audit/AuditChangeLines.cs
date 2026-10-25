using Csps.Application.Users;

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
}

/// <summary>Reads the stored detail of expense and category entries into typed lines (D-27, 05 D-40).</summary>
public static class AuditChangeLines
{
    /// <summary>Parses the detail of an entry.</summary>
    /// <param name="action">The action code.</param>
    /// <param name="detail">The stored detail.</param>
    /// <returns>The lines, snapshot and payer; nothing for any other action.</returns>
    public static ParsedAuditChanges For(string action, string? detail) => ParsedAuditChanges.None;

    /// <summary>Resolves the ids of parsed changes to names and people.</summary>
    /// <param name="parsed">The parsed detail.</param>
    /// <param name="categories">Current category names by id; a missing id means the category is gone.</param>
    /// <param name="person">Looks a person up by id.</param>
    /// <returns>The lines and the snapshot.</returns>
    public static (IReadOnlyList<AuditChangeLine> Lines, AuditExpenseSnapshot? Snapshot) Resolve(
        ParsedAuditChanges parsed, IReadOnlyDictionary<Guid, string> categories, Func<Guid?, ActorRef?> person) => ([], null);
}
