namespace Csps.Domain.QuoteRequests;

/// <summary>
/// One photo place of a quote request (INQ-02). The row exists from the moment the visitor names the file, so a photo that never
/// arrived stays visible to staff as an empty place (D-03). A place with no <see cref="PublicId"/> is a missing photo. A photo has
/// no creator (SEC-08).
/// </summary>
public sealed class QuoteRequestPhoto
{
    // Used by EF Core (constructor binding) and by QuoteRequest.DeclarePhotos.
    internal QuoteRequestPhoto(Guid quoteRequestId, int slot, string fileName)
    {
        QuoteRequestId = quoteRequestId;
        Slot = slot;
        FileName = fileName;
    }

    /// <summary>Gets the request the photo belongs to.</summary>
    public Guid QuoteRequestId { get; private set; }

    /// <summary>Gets the place of the photo, from 0 to 4.</summary>
    public int Slot { get; private set; }

    /// <summary>Gets the file name the visitor declared, cleaned of folders and control characters.</summary>
    public string FileName { get; private set; }

    /// <summary>Gets the storage id of the stored file; null while the photo is missing.</summary>
    public string? PublicId { get; private set; }

    /// <summary>Gets the upright width in pixels; null while the photo is missing.</summary>
    public int? Width { get; private set; }

    /// <summary>Gets the upright height in pixels; null while the photo is missing.</summary>
    public int? Height { get; private set; }

    /// <summary>Gets the stored size in bytes; null while the photo is missing.</summary>
    public int? Bytes { get; private set; }

    /// <summary>Gets the format key (<c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>); null while the photo is missing.</summary>
    public string? Kind { get; private set; }

    /// <summary>Gets when the file was stored, in UTC; null while the photo is missing.</summary>
    public DateTimeOffset? StoredAtUtc { get; private set; }
}
