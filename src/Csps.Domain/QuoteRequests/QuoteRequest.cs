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

    /// <summary>Moves the request to another status by hand (D-15).</summary>
    /// <param name="to">The new status.</param>
    /// <param name="by">The staff member who moved it.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>The storage ids of the photos to queue for removal.</returns>
    public Result<IReadOnlyList<string>> ChangeStatus(QuoteRequestStatus to, Guid by, DateTimeOffset now) =>
        Status == to && by == Guid.Empty && now == default ? Result.Success<IReadOnlyList<string>>([]) : Result.Success<IReadOnlyList<string>>([]);

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
