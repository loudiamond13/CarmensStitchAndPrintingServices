using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// What a Manager typed for a gallery upload, as typed (GAL-03, D-10). <see cref="GalleryEntry.Check"/> judges it and the entry trims the
/// texts it keeps. The pieces are a number so that a fraction such as 2.5 is refused with the same message as 0.
/// </summary>
/// <param name="TeamName">The team or name shown.</param>
/// <param name="ProductLineId">The product line the upload is filed under.</param>
/// <param name="Pieces">The pieces; null for none.</param>
/// <param name="Note">The note; null or empty for none.</param>
/// <param name="IsShown">True to show the upload on the website; null keeps it as it is (a new upload then starts hidden).</param>
public sealed record GalleryUploadValues(string? TeamName, Guid? ProductLineId, decimal? Pieces, string? Note, bool? IsShown);

/// <summary>What an edit changed in a gallery upload (AUDIT-01).</summary>
/// <param name="Fields">The API names of the changed fields in form order (<c>team</c>, <c>line</c>, <c>pieces</c>, <c>note</c>); the shown flag is not one of them.</param>
/// <param name="OldTeam">The team before.</param>
/// <param name="NewTeam">The team after.</param>
/// <param name="OldLineId">The line before.</param>
/// <param name="NewLineId">The line after.</param>
/// <param name="NowShown">True when it was hidden and is now shown, false for the other way round, null when the flag did not change.</param>
public sealed record GalleryUploadChanges(IReadOnlyList<string> Fields, string OldTeam, string NewTeam, Guid OldLineId, Guid NewLineId, bool? NowShown)
{
    /// <summary>Gets a value indicating whether anything changed.</summary>
    public bool HasChange => Fields.Count > 0 || NowShown is not null;
}

/// <summary>Where a gallery entry gets its photo from.</summary>
public enum GalleryEntryKind
{
    /// <summary>The photos of an order that staff put on the website (D-10).</summary>
    Order = 1,

    /// <summary>One photo a Manager uploaded for work that has no order in the system (GAL-03).</summary>
    Upload = 2,
}

/// <summary>
/// One place in the public gallery (D-10, GAL-03). Orders and direct uploads share one manual order, kept in <see cref="Position"/>: a newly
/// shown order or a new upload joins at the top, and a move swaps places. An order entry holds only the order id, because the photos, the
/// name, the line and the pieces come from the order itself. An upload entry holds its own photo, team, line, pieces and note. Who created
/// and changed it, and when, are set only by the database layer (SEC-08). A saved change clears the public cache (PUB-03).
/// </summary>
public sealed class GalleryEntry : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The longest team or name on an upload.</summary>
    public const int TeamNameMaxLength = 80;

    /// <summary>The longest note on an upload.</summary>
    public const int NoteMaxLength = 120;

    /// <summary>The fewest pieces on an upload.</summary>
    public const int MinPieces = 1;

    /// <summary>The most pieces on an upload.</summary>
    public const int MaxPieces = 9999;

    /// <summary>The longest stored photo id.</summary>
    public const int PublicIdMaxLength = 200;

    /// <summary>The longest photo format name.</summary>
    public const int FormatMaxLength = 8;

    /// <summary>The message for an upload with no photo.</summary>
    public const string PhotoRequiredMessage = "Choose a photo.";

    /// <summary>The message for a missing team or name.</summary>
    public const string TeamRequiredMessage = "Enter the team or name.";

    /// <summary>The message for a team or name over the limit.</summary>
    public const string TeamTooLongMessage = "Keep this to 80 characters or fewer.";

    /// <summary>The message for a missing product line.</summary>
    public const string LineRequiredMessage = "Choose the product line.";

    /// <summary>The message for pieces that are not a whole number from 1 to 9,999.</summary>
    public const string PiecesInvalidMessage = "Enter a whole number from 1 to 9,999.";

    /// <summary>The message for a note over the limit.</summary>
    public const string NoteTooLongMessage = "Keep the note to 120 characters or fewer.";

    // Used by EF Core (constructor binding) and by ForOrder.
    private GalleryEntry(Guid id, GalleryEntryKind kind, int position, DateTimeOffset createdAtUtc)
    {
        Id = id;
        Kind = kind;
        Position = position;
        CreatedAtUtc = createdAtUtc;
        RowVersion = [];
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets where the entry gets its photo from.</summary>
    public GalleryEntryKind Kind { get; private set; }

    /// <summary>Gets the order an order entry shows; null on an upload.</summary>
    public Guid? OrderId { get; private set; }

    /// <summary>Gets the place in the gallery order; a lower number is nearer the top.</summary>
    public int Position { get; private set; }

    /// <summary>Gets the random id the uploaded file is stored under; null on an order entry.</summary>
    public string? PublicId { get; private set; }

    /// <summary>Gets the uploaded photo's width in pixels; null on an order entry.</summary>
    public int? Width { get; private set; }

    /// <summary>Gets the uploaded photo's height in pixels; null on an order entry.</summary>
    public int? Height { get; private set; }

    /// <summary>Gets the size of the uploaded file in bytes; null on an order entry.</summary>
    public int? Bytes { get; private set; }

    /// <summary>Gets the uploaded file's format; null on an order entry.</summary>
    public string? Format { get; private set; }

    /// <summary>Gets the team or name shown on an upload; null on an order entry.</summary>
    public string? TeamName { get; private set; }

    /// <summary>Gets the product line an upload is filed under; null on an order entry.</summary>
    public Guid? ProductLineId { get; private set; }

    /// <summary>Gets the pieces on an upload; null when not given or on an order entry.</summary>
    public int? Pieces { get; private set; }

    /// <summary>Gets the note on an upload; null when none.</summary>
    public string? Note { get; private set; }

    /// <summary>Gets a value indicating whether the entry can show on the website.</summary>
    public bool IsShown { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Gets the optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>
    /// Checks what a Manager typed against the rules, so the request validator and the domain never disagree. A text is judged after
    /// trimming. Whether the line exists is checked by the handler.
    /// </summary>
    /// <param name="values">What was typed.</param>
    /// <returns>The messages by field name; empty when all is fine.</returns>
    public static Dictionary<string, string[]> Check(GalleryUploadValues values)
    {
        ArgumentNullException.ThrowIfNull(values);

        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        var team = values.TeamName?.Trim().Length ?? 0;
        if (team == 0)
        {
            errors["teamName"] = [TeamRequiredMessage];
        }
        else if (team > TeamNameMaxLength)
        {
            errors["teamName"] = [TeamTooLongMessage];
        }

        if (values.ProductLineId is null || values.ProductLineId == Guid.Empty)
        {
            errors["productLineId"] = [LineRequiredMessage];
        }

        if (values.Pieces is { } pieces && (pieces != decimal.Truncate(pieces) || pieces < MinPieces || pieces > MaxPieces))
        {
            errors["pieces"] = [PiecesInvalidMessage];
        }

        if (values.Note?.Trim().Length > NoteMaxLength)
        {
            errors["note"] = [NoteTooLongMessage];
        }

        return errors;
    }

    /// <summary>Gives an upload its id before its photo is stored, because the photo's folder is named after it.</summary>
    /// <param name="now">The current instant, which makes the id.</param>
    /// <returns>A new version 7 id.</returns>
    public static Guid NewId(DateTimeOffset now) => Guid.CreateVersion7(now);

    /// <summary>Builds the entry of a direct upload whose photo is already stored and measured.</summary>
    /// <param name="id">The id from <see cref="NewId"/>, which names the photo's folder.</param>
    /// <param name="values">What was typed; the upload is hidden unless <see cref="GalleryUploadValues.IsShown"/> is true.</param>
    /// <param name="file">The stored photo's facts.</param>
    /// <param name="position">The place in the order; one below the current top puts it first.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>The new, unsaved entry, or a validation error naming the broken fields.</returns>
    public static Result<GalleryEntry> CreateUpload(Guid id, GalleryUploadValues values, LinePhotoFile file, int position, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(values);
        ArgumentNullException.ThrowIfNull(file);

        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<GalleryEntry>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var entry = new GalleryEntry(id, GalleryEntryKind.Upload, position, now)
        {
            PublicId = file.PublicId,
            Width = file.Width,
            Height = file.Height,
            Bytes = file.Bytes,
            Format = file.Format,
            IsShown = values.IsShown ?? false,
        };
        _ = entry.Apply(values);
        return Result.Success(entry);
    }

    /// <summary>Changes the upload to what a Manager typed. A failure changes nothing.</summary>
    /// <param name="values">What was typed; a null <see cref="GalleryUploadValues.IsShown"/> keeps the upload shown or hidden as it is.</param>
    /// <returns>What changed (nothing when the form holds the same values), or a validation error naming the broken fields.</returns>
    /// <exception cref="InvalidOperationException">The entry is an order entry, which is changed on its order.</exception>
    public Result<GalleryUploadChanges> UpdateUpload(GalleryUploadValues values)
    {
        RequireUpload();
        ArgumentNullException.ThrowIfNull(values);
        var errors = Check(values);
        if (errors.Count > 0)
        {
            return Result.Failure<GalleryUploadChanges>(Error.Validation(SiteSettings.InvalidCode, SiteSettings.InvalidMessage, errors));
        }

        var oldTeam = TeamName!;
        var oldLine = ProductLineId!.Value;
        var fields = Apply(values);
        bool? nowShown = null;
        if (values.IsShown is { } shown && shown != IsShown)
        {
            IsShown = shown;
            nowShown = shown;
        }

        return Result.Success(new GalleryUploadChanges(fields, oldTeam, TeamName!, oldLine, ProductLineId!.Value, nowShown));
    }

    /// <summary>Puts a new photo file in this upload's place. The old file is no longer named by any row.</summary>
    /// <param name="file">The new stored file's facts.</param>
    /// <returns>The public id of the file that was replaced, which the caller must queue for removal.</returns>
    /// <exception cref="InvalidOperationException">The entry is an order entry, which takes its photos from the order.</exception>
    public string ReplacePhoto(LinePhotoFile file)
    {
        RequireUpload();
        ArgumentNullException.ThrowIfNull(file);
        var old = PublicId!;
        PublicId = file.PublicId;
        Width = file.Width;
        Height = file.Height;
        Bytes = file.Bytes;
        Format = file.Format;
        return old;
    }

    /// <summary>Takes the upload off the website.</summary>
    /// <returns>True when it was shown and is now hidden.</returns>
    /// <exception cref="InvalidOperationException">The entry is an order entry, which is taken off on its order.</exception>
    public bool Hide()
    {
        RequireUpload();
        var changed = IsShown;
        IsShown = false;
        return changed;
    }

    /// <summary>Puts the upload on the website.</summary>
    /// <returns>True when it was hidden and is now shown.</returns>
    /// <exception cref="InvalidOperationException">The entry is an order entry, which is shown on its order.</exception>
    public bool Show()
    {
        RequireUpload();
        var changed = !IsShown;
        IsShown = true;
        return changed;
    }

    /// <summary>Builds the entry that gives a shown order its place in the gallery.</summary>
    /// <param name="orderId">The order.</param>
    /// <param name="position">The place in the order; one below the current top puts it first.</param>
    /// <param name="now">The current instant, which makes the id.</param>
    /// <returns>The new, unsaved entry.</returns>
    public static GalleryEntry ForOrder(Guid orderId, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), GalleryEntryKind.Order, position, now)
        {
            OrderId = orderId,
            IsShown = true,
        };

    private static bool Differs(string? current, string? typed, out string? next)
    {
        var trimmed = typed?.Trim();
        next = string.IsNullOrEmpty(trimmed) ? null : trimmed;
        return !string.Equals(current, next, StringComparison.Ordinal);
    }

    // An order entry has no upload fields; its photos, name and line come from the order.
    private void RequireUpload()
    {
        if (Kind != GalleryEntryKind.Upload)
        {
            throw new InvalidOperationException("An order entry takes its photos, name and line from its order.");
        }
    }

    // Sets every typed value and names the fields that were different, in form order. Check has already refused a missing team or line.
    private List<string> Apply(GalleryUploadValues values)
    {
        var fields = new List<string>();
        if (Differs(TeamName, values.TeamName, out var team))
        {
            TeamName = team;
            fields.Add("team");
        }

        if (values.ProductLineId != ProductLineId)
        {
            ProductLineId = values.ProductLineId;
            fields.Add("line");
        }

        int? pieces = values.Pieces is { } typedPieces ? (int)typedPieces : null;
        if (pieces != Pieces)
        {
            Pieces = pieces;
            fields.Add("pieces");
        }

        if (Differs(Note, values.Note, out var note))
        {
            Note = note;
            fields.Add("note");
        }

        return fields;
    }
}
