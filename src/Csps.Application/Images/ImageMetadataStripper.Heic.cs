using System.Buffers.Binary;
using System.Text;

namespace Csps.Application.Images;

// HEIC: the Exif and XMP items are wiped in place, so no length or offset in the file changes.
public static partial class ImageMetadataStripper
{
    private const int MaxHeicEntries = 4096;
    private const long OutOfRange = 1L << 40;

    // Finds the items of type Exif and the mime items with an XMP content type (iinf), finds where their bytes are (iloc, construction
    // method 0 = file offset into an mdat box, 1 = offset into the idat box) and sets those bytes to zero. A file whose metadata
    // bytes cannot be located with certainty is refused: another construction method, data in another file, an unsized extent, an
    // extent outside the data boxes, or an extent that shares bytes with any other item (which would damage the picture).
    private static byte[]? StripHeic(ReadOnlySpan<byte> bytes)
    {
        var boxes = new ChunkReader(bytes, ChunkLayout.Box);
        var mdats = new List<ByteRange>();
        ReadOnlySpan<byte> meta = default;
        var metaAt = 0;
        var haveMeta = false;
        var first = true;
        while (boxes.Next(out var type, out var payload, out var start, out var length))
        {
            if (first && !type.SequenceEqual("ftyp"u8))
            {
                return null;
            }

            first = false;
            var payloadAt = start + length - payload.Length;
            if (type.SequenceEqual("mdat"u8))
            {
                mdats.Add(new ByteRange(payloadAt, payloadAt + payload.Length));
            }
            else if (type.SequenceEqual("meta"u8) && !haveMeta)
            {
                meta = payload;
                metaAt = payloadAt;
                haveMeta = true;
            }
        }

        if (!haveMeta || meta.Length < 4)
        {
            return null;
        }

        ReadOnlySpan<byte> iinf = default;
        ReadOnlySpan<byte> iloc = default;
        ByteRange? idat = null;
        var haveIinf = false;
        var haveIloc = false;
        var children = new ChunkReader(meta[4..], ChunkLayout.Box);
        while (children.Next(out var type, out var payload, out var start, out var length))
        {
            var payloadAt = metaAt + 4 + start + length - payload.Length;
            if (type.SequenceEqual("iinf"u8) && !haveIinf)
            {
                iinf = payload;
                haveIinf = true;
            }
            else if (type.SequenceEqual("iloc"u8) && !haveIloc)
            {
                iloc = payload;
                haveIloc = true;
            }
            else if (type.SequenceEqual("idat"u8) && idat is null)
            {
                idat = new ByteRange(payloadAt, payloadAt + payload.Length);
            }
            else if (type.SequenceEqual("iinf"u8) || type.SequenceEqual("iloc"u8) || type.SequenceEqual("idat"u8))
            {
                return null;
            }
        }

        if (!children.AtEnd)
        {
            return null;
        }

        var metadataItems = new List<uint>();
        if (haveIinf && !TryReadMetadataItems(iinf, metadataItems))
        {
            return null;
        }

        // Nothing to wipe: no metadata item, or none of them has any bytes in this file.
        if (metadataItems.Count == 0 || !haveIloc)
        {
            return bytes.ToArray();
        }

        var extents = new List<ItemExtent>();
        if (!TryReadLocations(iloc, extents, out var hasLengths))
        {
            return null;
        }

        return WipeExtents(bytes, extents, metadataItems, hasLengths, mdats, idat);
    }

    private static byte[]? WipeExtents(ReadOnlySpan<byte> bytes, List<ItemExtent> extents, List<uint> metadataItems, bool hasLengths, List<ByteRange> mdats, ByteRange? idat)
    {
        var wipes = new List<ByteRange>();
        foreach (var extent in extents.Where(extent => metadataItems.Contains(extent.Item)))
        {
            if (extent.Method > 1 || extent.DataReference != 0 || !hasLengths || !TryPlace(extent, mdats, idat, out var range))
            {
                return null;
            }

            wipes.Add(range);
        }

        foreach (var extent in extents.Where(extent => !metadataItems.Contains(extent.Item)))
        {
            if (extent.Method <= 1 && extent.DataReference == 0 && TryPlace(extent, mdats, idat, out var other) && wipes.Exists(wipe => wipe.Start < other.End && other.Start < wipe.End))
            {
                return null;
            }
        }

        var output = bytes.ToArray();
        foreach (var wipe in wipes)
        {
            output.AsSpan((int)wipe.Start, (int)(wipe.End - wipe.Start)).Clear();
        }

        return output;
    }

    // Turns an extent into the bytes it covers in the file, or fails when they are not wholly inside a data box that belongs to it.
    private static bool TryPlace(ItemExtent extent, List<ByteRange> mdats, ByteRange? idat, out ByteRange range)
    {
        range = default;
        if (extent.Method == 1)
        {
            if (idat is not { } box)
            {
                return false;
            }

            range = new ByteRange(box.Start + extent.Start, box.Start + extent.Start + extent.Length);
            return range.End <= box.End;
        }

        var placed = new ByteRange(extent.Start, extent.Start + extent.Length);
        range = placed;
        return mdats.Exists(mdat => placed.Start >= mdat.Start && placed.End <= mdat.End);
    }

    // iinf is a full box (a 16-bit entry count in version 0, 32-bit later) of infe boxes.
    private static bool TryReadMetadataItems(ReadOnlySpan<byte> iinf, List<uint> items)
    {
        var headerSize = iinf.Length > 0 && iinf[0] == 0 ? 6 : 8;
        if (iinf.Length < headerSize)
        {
            return false;
        }

        var entries = new ChunkReader(iinf[headerSize..], ChunkLayout.Box);
        while (entries.Next(out var type, out var payload))
        {
            if (!type.SequenceEqual("infe"u8))
            {
                continue;
            }

            if (!TryReadItemInfo(payload, out var item, out var isMetadata))
            {
                return false;
            }

            if (isMetadata)
            {
                items.Add(item);
            }
        }

        return entries.AtEnd;
    }

    // infe versions 2 and 3 name the item type (a 16-bit or 32-bit item number); versions 0 and 1 have no type, so only an XMP content
    // type can be recognized there. After the type come the item name and, for mime items, the content type, both ended by a zero byte.
    private static bool TryReadItemInfo(ReadOnlySpan<byte> infe, out uint item, out bool isMetadata)
    {
        item = 0;
        isMetadata = false;
        if (infe.Length < 8 || infe[0] > 3)
        {
            return false;
        }

        var version = infe[0];
        ReadOnlySpan<byte> type = default;
        int position;
        if (version < 2)
        {
            item = BinaryPrimitives.ReadUInt16BigEndian(infe[4..]);
            position = 8;
        }
        else
        {
            var idSize = version == 2 ? 2 : 4;
            position = 4 + idSize + 2 + 4;
            if (infe.Length < position)
            {
                return false;
            }

            item = idSize == 2 ? BinaryPrimitives.ReadUInt16BigEndian(infe[4..]) : BinaryPrimitives.ReadUInt32BigEndian(infe[4..]);
            type = infe.Slice(position - 4, 4);
        }

        var rest = infe[position..];
        var nameEnd = rest.IndexOf((byte)0);
        if (nameEnd < 0)
        {
            return false;
        }

        if (version >= 2 && type.SequenceEqual("Exif"u8))
        {
            isMetadata = true;
            return true;
        }

        if (version < 2 || type.SequenceEqual("mime"u8))
        {
            var content = rest[(nameEnd + 1)..];
            var contentEnd = content.IndexOf((byte)0);
            isMetadata = Ascii.EqualsIgnoreCase(contentEnd < 0 ? content : content[..contentEnd], "application/rdf+xml"u8);
        }

        return true;
    }

    // iloc: a full box, the size of the offset and length fields (4 bits each), the size of the base offset and (version 1 and 2) of
    // the extent index, an item count, then per item the number, (version 1 and 2) the construction method, the data reference
    // index, a base offset and the extents. Offsets are added to the base offset. Oversized numbers become a value that is out of range.
    private static bool TryReadLocations(ReadOnlySpan<byte> iloc, List<ItemExtent> extents, out bool hasLengths)
    {
        hasLengths = false;
        if (iloc.Length < 8 || iloc[0] > 2)
        {
            return false;
        }

        var version = iloc[0];
        var offsetSize = iloc[4] >> 4;
        var lengthSize = iloc[4] & 0x0F;
        var baseSize = iloc[5] >> 4;
        var indexSize = version == 0 ? 0 : iloc[5] & 0x0F;
        hasLengths = lengthSize != 0;
        if (!IsFieldSize(offsetSize) || !IsFieldSize(lengthSize) || !IsFieldSize(baseSize) || !IsFieldSize(indexSize))
        {
            return false;
        }

        var position = 6;
        if (!TryReadNumber(iloc, ref position, version < 2 ? 2 : 4, out var count) || count > MaxHeicEntries)
        {
            return false;
        }

        for (var index = 0u; index < count; index++)
        {
            if (!TryReadNumber(iloc, ref position, version < 2 ? 2 : 4, out var item))
            {
                return false;
            }

            ulong method = 0;
            if (version >= 1 && !TryReadNumber(iloc, ref position, 2, out method))
            {
                return false;
            }

            if (!TryReadNumber(iloc, ref position, 2, out var dataReference)
                || !TryReadNumber(iloc, ref position, baseSize, out var baseOffset)
                || !TryReadNumber(iloc, ref position, 2, out var extentCount))
            {
                return false;
            }

            for (ulong extent = 0; extent < extentCount; extent++)
            {
                if (extents.Count >= MaxHeicEntries
                    || !TryReadNumber(iloc, ref position, indexSize, out _)
                    || !TryReadNumber(iloc, ref position, offsetSize, out var offset)
                    || !TryReadNumber(iloc, ref position, lengthSize, out var length))
                {
                    return false;
                }

                extents.Add(new ItemExtent((uint)item, (int)(method & 0x0F), (int)dataReference, Bounded(baseOffset) + Bounded(offset), Bounded(length)));
            }
        }

        return true;
    }

    private static bool IsFieldSize(int size) => size is 0 or 4 or 8;

    private static long Bounded(ulong value) => value > OutOfRange ? OutOfRange : (long)value;

    // Reads a big-endian number of 0, 2, 4 or 8 bytes; false when the box ends first.
    private static bool TryReadNumber(ReadOnlySpan<byte> data, ref int position, int size, out ulong value)
    {
        value = 0;
        if (position + size > data.Length)
        {
            return false;
        }

        var field = data.Slice(position, size);
        value = size switch
        {
            2 => BinaryPrimitives.ReadUInt16BigEndian(field),
            4 => BinaryPrimitives.ReadUInt32BigEndian(field),
            8 => BinaryPrimitives.ReadUInt64BigEndian(field),
            _ => 0,
        };
        position += size;
        return true;
    }

    // The bytes from Start up to but not including End, counted from the start of the file.
    private readonly record struct ByteRange(long Start, long End);

    // One stretch of an item's bytes: Start is the base offset plus the extent offset.
    private readonly record struct ItemExtent(uint Item, int Method, int DataReference, long Start, long Length);
}
