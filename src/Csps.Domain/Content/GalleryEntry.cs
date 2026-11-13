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
        entry.Apply(values);
        return Result.Success(entry);
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

    // Sets the typed values on a new entry. Check has already refused a missing team or line.
    private void Apply(GalleryUploadValues values)
    {
        TeamName = values.TeamName!.Trim();
        ProductLineId = values.ProductLineId;
        Pieces = values.Pieces is { } pieces ? (int)pieces : null;
        var note = values.Note?.Trim();
        Note = string.IsNullOrEmpty(note) ? null : note;
    }
}
