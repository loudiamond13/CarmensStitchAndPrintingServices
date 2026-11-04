using Csps.Domain.Common;

namespace Csps.Domain.Orders;

/// <summary>
/// One photo of an order (ORD-04, IMG-03). The file lives in the image storage under <see cref="PublicId"/>; the row keeps the id,
/// the size and format of the file as stored, and an optional description. <see cref="Slot"/> is the photo's fixed place from 0 to 4
/// and carries the database guard of the 5-photo limit; <see cref="Position"/> is the display order, 0 being the cover. Who added it
/// and when are set only by the database layer (SEC-08).
/// </summary>
public sealed class OrderImage : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Order.AddImage.
    internal OrderImage(Guid id, Guid orderId, int slot, int position, string publicId, int width, int height, int bytes, string format, string? description)
    {
        Id = id;
        OrderId = orderId;
        Slot = slot;
        Position = position;
        PublicId = publicId;
        Width = width;
        Height = height;
        Bytes = bytes;
        Format = format;
        Description = description;
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order the photo belongs to.</summary>
    public Guid OrderId { get; private set; }

    /// <summary>Gets the order the photo belongs to.</summary>
    public Order Order { get; internal set; } = null!;

    /// <summary>Gets the photo's fixed place from 0 to 4; it never changes, and the database allows one photo per slot.</summary>
    public int Slot { get; private set; }

    /// <summary>Gets the display order from 0; the photo at 0 is the cover.</summary>
    public int Position { get; private set; }

    /// <summary>Gets the random id the file is stored under; never shown to the public and never logged.</summary>
    public string PublicId { get; private set; }

    /// <summary>Gets the width in pixels, as the photo is shown upright.</summary>
    public int Width { get; private set; }

    /// <summary>Gets the height in pixels, as the photo is shown upright.</summary>
    public int Height { get; private set; }

    /// <summary>Gets the size of the stored file in bytes.</summary>
    public int Bytes { get; private set; }

    /// <summary>Gets the file format: <c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>.</summary>
    public string Format { get; private set; }

    /// <summary>Gets the description, trimmed; null when the default text applies.</summary>
    public string? Description { get; private set; }

    // Used by Order.MoveImage; the slot and the file never change.
    internal void MoveTo(int position) => Position = position;

    // Used by Order.DescribeImage; the text is already cleaned.
    internal void Describe(string? description) => Description = description;

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }
}

/// <summary>A photo as the use case gives it to <see cref="Order.AddImage"/>: already stored, already measured.</summary>
/// <param name="PublicId">The random id the file was stored under.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
/// <param name="Bytes">The size of the stored file in bytes.</param>
/// <param name="Format">The file format: <c>jpg</c>, <c>png</c>, <c>webp</c> or <c>heic</c>.</param>
/// <param name="Description">The description as typed; null or blank for none.</param>
public sealed record NewOrderImage(string PublicId, int Width, int Height, int Bytes, string Format, string? Description);
