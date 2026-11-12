using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>
/// One photo of a product line (D-02): the main photo, the back view or the fabric detail. The file lives in the image storage under
/// <see cref="PublicId"/>; the row keeps the id, the size and the format of the file as stored. A line has at most one photo in each
/// slot. Who added and changed it, and when, are set only by the database layer (SEC-08). A saved change clears the public cache (PUB-03).
/// </summary>
public sealed class ProductLinePhoto : IAttributedRecord, IPublicContentRecord
{
    // Used by EF Core (constructor binding) and by Create.
    private ProductLinePhoto(
        Guid id,
        Guid lineId,
        ProductLinePhotoSlot slot,
        string publicId,
        int width,
        int height,
        int bytes,
        string format,
        DateTimeOffset createdAtUtc)
    {
        Id = id;
        LineId = lineId;
        Slot = slot;
        PublicId = publicId;
        Width = width;
        Height = height;
        Bytes = bytes;
        Format = format;
        CreatedAtUtc = createdAtUtc;
    }

    /// <summary>Primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>The product line the photo belongs to.</summary>
    public Guid LineId { get; private set; }

    /// <summary>The photo's fixed place on the line.</summary>
    public ProductLinePhotoSlot Slot { get; private set; }

    /// <summary>The random id the file is stored under.</summary>
    public string PublicId { get; private set; }

    /// <summary>The width in pixels, as the photo is shown upright.</summary>
    public int Width { get; private set; }

    /// <summary>The height in pixels, as the photo is shown upright.</summary>
    public int Height { get; private set; }

    /// <summary>The size of the stored file in bytes.</summary>
    public int Bytes { get; private set; }

    /// <summary>The file format: <c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>.</summary>
    public string Format { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Builds the photo row of a file that is already stored and measured.</summary>
    /// <param name="lineId">The product line.</param>
    /// <param name="slot">The place on the line.</param>
    /// <param name="publicId">The random id the file was stored under.</param>
    /// <param name="width">The upright width in pixels.</param>
    /// <param name="height">The upright height in pixels.</param>
    /// <param name="bytes">The size of the stored file in bytes.</param>
    /// <param name="format">The file format.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved photo.</returns>
    public static ProductLinePhoto Create(
        Guid lineId, ProductLinePhotoSlot slot, string publicId, int width, int height, int bytes, string format, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(publicId);
        ArgumentNullException.ThrowIfNull(format);
        return new ProductLinePhoto(Guid.CreateVersion7(now), lineId, slot, publicId, width, height, bytes, format, now);
    }
}
