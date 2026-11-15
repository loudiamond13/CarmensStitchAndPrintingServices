using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>The stored facts of a photo file that is already in the image storage.</summary>
/// <param name="PublicId">The random id the file was stored under.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
/// <param name="Bytes">The size of the stored file in bytes.</param>
/// <param name="Format">The file format: <c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>.</param>
public sealed record LinePhotoFile(string PublicId, int Width, int Height, int Bytes, string Format);

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

    /// <summary>Builds the photo row of a stored file.</summary>
    /// <param name="lineId">The product line.</param>
    /// <param name="slot">The place on the line.</param>
    /// <param name="file">The stored file's facts.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved photo.</returns>
    public static ProductLinePhoto Create(Guid lineId, ProductLinePhotoSlot slot, LinePhotoFile file, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(file);
        return Create(lineId, slot, file.PublicId, file.Width, file.Height, file.Bytes, file.Format, now);
    }

    /// <summary>Puts a new file in this photo's place. The row keeps its id and slot; the old file is no longer named by any row.</summary>
    /// <param name="file">The new stored file's facts.</param>
    /// <returns>The public id of the file that was replaced, which the caller must queue for removal.</returns>
    public string Replace(LinePhotoFile file)
    {
        ArgumentNullException.ThrowIfNull(file);
        var old = PublicId;
        PublicId = file.PublicId;
        Width = file.Width;
        Height = file.Height;
        Bytes = file.Bytes;
        Format = file.Format;
        return old;
    }
}
