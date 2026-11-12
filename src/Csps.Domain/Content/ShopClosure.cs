using System.Globalization;
using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>What changed in a closure: the days before and after, and whether the note changed (AUDIT-01).</summary>
/// <param name="OldFirstDay">The first day before the change.</param>
/// <param name="OldLastDay">The last day before the change.</param>
/// <param name="NewFirstDay">The first day after the change.</param>
/// <param name="NewLastDay">The last day after the change.</param>
/// <param name="NoteChanged">True when the note changed; the note text is never copied into the audit log.</param>
public sealed record ShopClosureChange(DateOnly OldFirstDay, DateOnly OldLastDay, DateOnly NewFirstDay, DateOnly NewLastDay, bool NoteChanged);

/// <summary>
/// A holiday or closure (CONT-04, D-21): the shop is closed all day on every day from the first day to the last day, both included. A
/// closure is one to 31 days long and never overlaps another one. A new closure starts today or later in business time; an edit keeps
/// a first day that is already past, so the note of a closure that is running can still be fixed. The attribution members are set only
/// by the database layer (SEC-08).
/// </summary>
public sealed class ShopClosure : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The longest a closure can be, in days.</summary>
    public const int MaxSpanDays = 31;

    /// <summary>The longest note.</summary>
    public const int NoteMaxLength = 80;

    /// <summary>How many days ahead the public site lists closures.</summary>
    public const int PublicWindowDays = 30;

    /// <summary>How many days ahead search results list closures as closed days.</summary>
    public const int SearchWindowDays = 60;

    /// <summary>The message for a missing first day.</summary>
    public const string FirstDayRequiredMessage = "Enter the first day.";

    /// <summary>The message for a first day that is not a real date.</summary>
    public const string FirstDayInvalidMessage = "Enter a real date.";

    /// <summary>The message for a last day that is not a real date.</summary>
    public const string LastDayInvalidMessage = "Enter a real date.";

    /// <summary>The message for a first day before the business today.</summary>
    public const string FirstDayPastMessage = "Pick today or a later date.";

    /// <summary>The message for a last day before the first day.</summary>
    public const string LastBeforeFirstMessage = "The last day must be on or after the first day.";

    /// <summary>The message for a closure longer than <see cref="MaxSpanDays"/> days.</summary>
    public const string SpanTooLongMessage = "A closure can be up to 31 days. Add another one for longer.";

    /// <summary>The message for a note over the limit.</summary>
    public const string NoteTooLongMessage = "Keep the note to 80 characters or fewer.";

    // Used by EF Core (constructor binding).
    private ShopClosure(
        Guid id,
        DateOnly firstDay,
        DateOnly lastDay,
        string? note,
        DateTimeOffset createdAtUtc,
        Guid? createdById,
        DateTimeOffset? updatedAtUtc,
        Guid? updatedById,
        byte[] rowVersion)
    {
        Id = id;
        FirstDay = firstDay;
        LastDay = lastDay;
        Note = note;
        CreatedAtUtc = createdAtUtc;
        CreatedById = createdById;
        UpdatedAtUtc = updatedAtUtc;
        UpdatedById = updatedById;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The first closed day.</summary>
    public DateOnly FirstDay { get; private set; }

    /// <summary>The last closed day; the same as the first for a single day.</summary>
    public DateOnly LastDay { get; private set; }

    /// <summary>A short reason shown to visitors; null when there is none.</summary>
    public string? Note { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Gets the closure as the page reads it: the days and the note.</summary>
    public ClosureSpan Span => new(FirstDay, LastDay, Note);

    /// <summary>Trims a note; an empty note becomes none.</summary>
    /// <param name="note">The typed note.</param>
    /// <returns>The trimmed note, or null when there is none.</returns>
    public static string? NormalizeNote(string? note)
    {
        var trimmed = note?.Trim();
        return string.IsNullOrEmpty(trimmed) ? null : trimmed;
    }

    /// <summary>
    /// Checks the days and the note against the rules, so the request validator and the domain never disagree. The first day must not
    /// be before the business today when <paramref name="requireFirstDayFromToday"/> is true, the last day must not be before the first,
    /// the closure is at most <see cref="MaxSpanDays"/> days, and the note is at most <see cref="NoteMaxLength"/> characters.
    /// </summary>
    /// <param name="firstDay">The first day.</param>
    /// <param name="lastDay">The last day, or null for one day.</param>
    /// <param name="note">The note, trimmed or not.</param>
    /// <param name="today">The business today.</param>
    /// <param name="requireFirstDayFromToday">True for a new closure or an edit that moves the first day.</param>
    /// <returns>The messages by field name (<c>firstDay</c>, <c>lastDay</c> or <c>note</c>); empty when all is fine.</returns>
    public static Dictionary<string, string[]> Check(DateOnly firstDay, DateOnly? lastDay, string? note, DateOnly today, bool requireFirstDayFromToday)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (requireFirstDayFromToday && firstDay < today)
        {
            errors["firstDay"] = [FirstDayPastMessage];
        }

        if (lastDay is { } last)
        {
            if (last < firstDay)
            {
                errors["lastDay"] = [LastBeforeFirstMessage];
            }
            else if (last.DayNumber - firstDay.DayNumber + 1 > MaxSpanDays)
            {
                errors["lastDay"] = [SpanTooLongMessage];
            }
        }

        if (NormalizeNote(note)?.Length > NoteMaxLength)
        {
            errors["note"] = [NoteTooLongMessage];
        }

        return errors;
    }

    /// <summary>Builds a closure from what a Manager typed.</summary>
    /// <param name="firstDay">The first day.</param>
    /// <param name="lastDay">The last day, or null for one day.</param>
    /// <param name="note">The note; trimmed, and empty becomes none.</param>
    /// <param name="today">The business today.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved closure, or a validation error naming <c>firstDay</c>, <c>lastDay</c> or <c>note</c>.</returns>
    public static Result<ShopClosure> Create(DateOnly firstDay, DateOnly? lastDay, string? note, DateOnly today, DateTimeOffset now)
    {
        var errors = Check(firstDay, lastDay, note, today, requireFirstDayFromToday: true);
        if (errors.Count > 0)
        {
            return Result.Failure<ShopClosure>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        return Result.Success(new ShopClosure(Guid.CreateVersion7(now), firstDay, lastDay ?? firstDay, NormalizeNote(note), now, null, null, null, []));
    }

    /// <summary>
    /// Changes the days and the note. The first day is checked against today only when it moves, so a closure that already started can
    /// still get a new note or a new last day. A failure changes nothing.
    /// </summary>
    /// <param name="firstDay">The new first day.</param>
    /// <param name="lastDay">The new last day, or null for one day.</param>
    /// <param name="note">The new note; trimmed, and empty becomes none.</param>
    /// <param name="today">The business today.</param>
    /// <returns>The change, null when nothing is different, or a validation error naming <c>firstDay</c>, <c>lastDay</c> or <c>note</c>.</returns>
    public Result<ShopClosureChange?> Change(DateOnly firstDay, DateOnly? lastDay, string? note, DateOnly today)
    {
        var errors = Check(firstDay, lastDay, note, today, requireFirstDayFromToday: firstDay != FirstDay);
        if (errors.Count > 0)
        {
            return Result.Failure<ShopClosureChange?>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var newLast = lastDay ?? firstDay;
        var newNote = NormalizeNote(note);
        var noteChanged = !string.Equals(newNote, Note, StringComparison.Ordinal);
        if (firstDay == FirstDay && newLast == LastDay && !noteChanged)
        {
            return Result.Success<ShopClosureChange?>(null);
        }

        var change = new ShopClosureChange(FirstDay, LastDay, firstDay, newLast, noteChanged);
        FirstDay = firstDay;
        LastDay = newLast;
        Note = newNote;
        return Result.Success<ShopClosureChange?>(change);
    }

    /// <summary>Tells whether this closure and another share at least one day. Closures that only touch (one ends the day before the other starts) do not overlap.</summary>
    /// <param name="other">The other closure.</param>
    /// <returns>True when both cover a common day.</returns>
    public bool Overlaps(ShopClosure other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return FirstDay <= other.LastDay && other.FirstDay <= LastDay;
    }

    /// <summary>Gives the first day both closures cover.</summary>
    /// <param name="other">The other closure.</param>
    /// <returns>The first shared day, or null when they do not overlap.</returns>
    public DateOnly? FirstSharedDay(ShopClosure other)
    {
        ArgumentNullException.ThrowIfNull(other);
        return Overlaps(other) ? (FirstDay > other.FirstDay ? FirstDay : other.FirstDay) : null;
    }

    /// <summary>Writes the message for a closure that overlaps another, naming the first shared day in the en-PH short form ("Dec 25, 2026").</summary>
    /// <param name="day">The first shared day.</param>
    /// <returns>The message.</returns>
    public static string OverlapMessage(DateOnly day) =>
        string.Create(CultureInfo.InvariantCulture, $"There's already a closure on {day.ToString("MMM d, yyyy", CultureInfo.InvariantCulture)}.");
}
