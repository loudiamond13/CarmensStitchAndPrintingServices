using Csps.Domain.Common;

namespace Csps.Domain.QuoteRequests;

/// <summary>
/// A quote request a visitor sent from the Contact page (INQ-01). The aggregate checks every field rule itself, so no caller can
/// save a request that would not fit the New Order form later. A visitor has no account, so the record has no creator (SEC-08):
/// the stamp reads a missing user as nobody. Who and when come from the clock, never from the request body.
/// </summary>
public sealed class QuoteRequest : IAttributedRecord, IEditVersioned
{
    private readonly List<QuoteRequestPhoto> _photos = [];
    private readonly List<QuoteRequestStatusChange> _statusChanges = [];
    private readonly List<QuoteRequestNote> _notes = [];

    // Used by EF Core (constructor binding) and by Receive.
    private QuoteRequest(
        Guid id,
        string customerName,
        string? teamName,
        string contactNumberE164,
        string? email,
        QuoteProductChoice? productChoice,
        Guid? productLineId,
        string? productTitle,
        QuoteQuantityRange? quantityRange,
        string? message,
        QuoteRequestStatus status,
        DateTimeOffset statusChangedAtUtc)
    {
        Id = id;
        CustomerName = customerName;
        TeamName = teamName;
        ContactNumberE164 = contactNumberE164;
        Email = email;
        ProductChoice = productChoice;
        ProductLineId = productLineId;
        ProductTitle = productTitle;
        QuantityRange = quantityRange;
        Message = message;
        Status = status;
        StatusChangedAtUtc = statusChangedAtUtc;
        RowVersion = [];
    }

    /// <summary>Gets the primary key, a version 7 id made by the caller from the clock.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the visitor's name, trimmed.</summary>
    public string CustomerName { get; private set; }

    /// <summary>Gets the team or organization; null when none.</summary>
    public string? TeamName { get; private set; }

    /// <summary>Gets the mobile number as E.164, such as <c>+639171234567</c>.</summary>
    public string ContactNumberE164 { get; private set; }

    /// <summary>Gets the email address; null when none.</summary>
    public string? Email { get; private set; }

    /// <summary>Gets what the visitor chose in the product list; null when nothing was chosen.</summary>
    public QuoteProductChoice? ProductChoice { get; private set; }

    /// <summary>Gets the chosen product line; null for another choice, or after the line was deleted.</summary>
    public Guid? ProductLineId { get; private set; }

    /// <summary>Gets the title of the chosen line at the moment of the request (D-24); null for another choice.</summary>
    public string? ProductTitle { get; private set; }

    /// <summary>Gets the estimated quantity; null when none was chosen.</summary>
    public QuoteQuantityRange? QuantityRange { get; private set; }

    /// <summary>Gets what the visitor wrote; null when nothing.</summary>
    public string? Message { get; private set; }

    /// <summary>Gets the current status.</summary>
    public QuoteRequestStatus Status { get; private set; }

    /// <summary>Gets when the status last changed, in UTC.</summary>
    public DateTimeOffset StatusChangedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid EditVersion { get; private set; }

    /// <summary>Gets the row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Gets the SHA-256 of the upload key the visitor made; null when no photo was declared. The key itself is never stored (CWE-639).</summary>
    public byte[]? UploadKeyHash { get; private set; }

    /// <summary>Gets when the upload key stops working, in UTC; null when no photo was declared.</summary>
    public DateTimeOffset? UploadKeyExpiresAtUtc { get; private set; }

    /// <summary>Gets when the photos were removed because the request was marked Spam (D-04); null while they are kept.</summary>
    public DateTimeOffset? PhotosRemovedAtUtc { get; private set; }

    /// <summary>Gets the photo places the visitor declared, in slot order.</summary>
    public IReadOnlyList<QuoteRequestPhoto> Photos => _photos;

    /// <summary>Gets the status moves staff made, oldest first.</summary>
    public IReadOnlyList<QuoteRequestStatusChange> StatusChanges => _statusChanges;

    /// <summary>Gets the internal staff notes added in this unit of work, oldest first.</summary>
    public IReadOnlyList<QuoteRequestNote> Notes => _notes;

    /// <summary>Adds an internal staff note (D-17). RED stub.</summary>
    /// <param name="text">The note.</param>
    /// <param name="by">Who wrote it.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>A failure until the note rules exist.</returns>
    public Result<QuoteRequestNote> AddNote(string text, Guid by, DateTimeOffset now) =>
        Result.Failure<QuoteRequestNote>(Error.NotFound("stub", $"{Id}{text}{by}{now}"));

    /// <summary>
    /// Declares the photos the visitor is about to send, one empty place per file name in the order given, and keeps the hash and the
    /// end time of the upload key. Each photo then travels in its own call (INQ-02). Allowed once, on a request that has no photo yet.
    /// </summary>
    /// <param name="fileNames">The file names as the visitor's browser reports them; at most <see cref="QuoteRequestRules.MaxPhotos"/>.</param>
    /// <param name="uploadKeyHash">The SHA-256 of the upload key, 32 bytes.</param>
    /// <param name="expiresAtUtc">When the key stops working.</param>
    /// <returns>A validation error on <c>photos</c> or <c>uploadKey</c> when a rule is broken; nothing changes then.</returns>
    public Result DeclarePhotos(IReadOnlyList<string> fileNames, byte[] uploadKeyHash, DateTimeOffset expiresAtUtc)
    {
        ArgumentNullException.ThrowIfNull(fileNames);
        ArgumentNullException.ThrowIfNull(uploadKeyHash);

        if (fileNames.Count == 0 || _photos.Count > 0)
        {
            return QuoteRequestRules.Reject(QuoteRequestRules.PhotosField, QuoteRequestRules.PhotosInvalid);
        }

        if (fileNames.Count > QuoteRequestRules.MaxPhotos)
        {
            return QuoteRequestRules.Reject(QuoteRequestRules.PhotosField, QuoteRequestRules.PhotosTooMany);
        }

        if (fileNames.Any(static name => name.Length > QuoteRequestRules.PhotoNameMaxLength))
        {
            return QuoteRequestRules.Reject(QuoteRequestRules.PhotosField, QuoteRequestRules.PhotoNameTooLong);
        }

        if (uploadKeyHash.Length != QuoteRequestRules.UploadKeyHashLength)
        {
            return QuoteRequestRules.Reject(QuoteRequestRules.UploadKeyField, QuoteRequestRules.UploadKeyInvalid);
        }

        for (var slot = 0; slot < fileNames.Count; slot++)
        {
            _photos.Add(new QuoteRequestPhoto(Id, slot, QuoteRequestRules.CleanPhotoName(fileNames[slot], slot)));
        }

        UploadKeyHash = [.. uploadKeyHash];
        UploadKeyExpiresAtUtc = expiresAtUtc;
        return Result.Success();
    }

    /// <summary>
    /// Moves the request to another status by hand (D-15). Moves among New, Contacted, Quoted, Closed and Spam are free in any direction.
    /// Converted is set only by turning the request into an order, and a Converted request keeps its status. Each move adds a history
    /// row with who and when and gives the request a new edit version, so the save stamps who last changed it. Entering Spam removes
    /// every photo place and returns the stored files for the caller to queue (D-04).
    /// </summary>
    /// <param name="to">The new status.</param>
    /// <param name="by">The staff member who moved it.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>The storage ids of the photos to queue for removal, or a 400 on <c>status</c>; nothing changes on a failure.</returns>
    public Result<IReadOnlyList<string>> ChangeStatus(QuoteRequestStatus to, Guid by, DateTimeOffset now)
    {
        if (Status == QuoteRequestStatus.Converted)
        {
            return Result.Failure<IReadOnlyList<string>>(Error.Validation(
                QuoteRequestRules.ConvertedLockedCode,
                QuoteRequestRules.ConvertedLockedMessage,
                new Dictionary<string, string[]> { [QuoteRequestRules.StatusField] = [QuoteRequestRules.ConvertedLockedMessage] }));
        }

        if (to == QuoteRequestStatus.Converted || !Enum.IsDefined(to))
        {
            return QuoteRequestRules.Reject<IReadOnlyList<string>>(QuoteRequestRules.StatusField, QuoteRequestRules.StatusInvalid);
        }

        if (to == Status)
        {
            var key = QuoteRequestStatusNames.ToKey(to);
            var name = string.Concat(char.ToUpperInvariant(key[0]).ToString(), key[1..]);
            return QuoteRequestRules.Reject<IReadOnlyList<string>>(
                QuoteRequestRules.StatusField,
                QuoteRequestRules.StatusAlreadyFormat.Replace("{0}", name, StringComparison.Ordinal));
        }

        _statusChanges.Add(new QuoteRequestStatusChange(Guid.CreateVersion7(now), Id, Status, to, by, now));
        Status = to;
        StatusChangedAtUtc = now;
        EditVersion = Guid.CreateVersion7(now);
        return Result.Success<IReadOnlyList<string>>(to == QuoteRequestStatus.Spam ? RemovePhotos(now) : []);
    }

    // Spam drops every photo place for good (D-04); the caller queues the stored files. Leaving Spam never brings them back.
    private List<string> RemovePhotos(DateTimeOffset now)
    {
        if (_photos.Count == 0)
        {
            return [];
        }

        List<string> stored = [.. _photos.Select(static photo => photo.PublicId).OfType<string>()];
        _photos.Clear();
        PhotosRemovedAtUtc = now;
        return stored;
    }

    /// <summary>Makes a new request at status New, checking every field rule again so no caller can skip one.</summary>
    /// <param name="id">The new id, a version 7 id.</param>
    /// <param name="input">The form.</param>
    /// <param name="now">The current instant, which becomes the creation and status time.</param>
    /// <returns>The new, unsaved request, or a validation error naming the first broken field.</returns>
    public static Result<QuoteRequest> Receive(Guid id, QuoteRequestInput input, DateTimeOffset now)
    {
        var cleaned = QuoteRequestRules.Check(input);
        if (cleaned.IsFailure)
        {
            return Result.Failure<QuoteRequest>(cleaned.Error);
        }

        var form = cleaned.Value;
        return Result.Success(new QuoteRequest(
            id,
            form.CustomerName,
            form.TeamName,
            form.ContactNumber,
            form.Email,
            form.ProductChoice,
            form.ProductLineId,
            form.ProductTitle,
            form.QuantityRange,
            form.Message,
            QuoteRequestStatus.New,
            now)
        {
            CreatedAtUtc = now,
            EditVersion = Guid.CreateVersion7(now),
        });
    }
}
