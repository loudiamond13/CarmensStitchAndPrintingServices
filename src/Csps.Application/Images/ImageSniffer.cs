using System.Buffers.Binary;

namespace Csps.Application.Images;

/// <summary>
/// Tells what a file is from its first bytes alone, without decoding it (IMG-02, T-09-01). The client's file name and content type are
/// never used. It reads the format, the stored size and the Exif orientation, checks every offset against the length of the file and
/// stops after a fixed number of segments, chunks or boxes, so a damaged or hostile file gives no answer instead of an exception or a
/// long loop. Only the header is read: no pixel is decoded and no native library is used.
/// </summary>
public static class ImageSniffer
{
    private const int MaxSegments = 512;
    private const int WebPHeaderSize = 12;
    private const int WebPAnimationFlag = 0x02;
    private const int MaxAssociations = 255;
    private const int MaxChunks = 512;
    private const int MaxItemEntries = 4096;
    private const int ExifOrientationTag = 0x0112;
    private const int TiffShort = 3;
    private const int TiffEntrySize = 12;

    private static ReadOnlySpan<byte> ExifHeader => "Exif\0\0"u8;

    /// <summary>Reads the format and size of a file.</summary>
    /// <param name="bytes">The whole file.</param>
    /// <returns>What the bytes say, or null when the file is not a photo this server accepts.</returns>
    public static ImageFacts? Inspect(ReadOnlySpan<byte> bytes) => bytes switch
    {
        [0xFF, 0xD8, 0xFF, ..] => InspectJpeg(bytes),
        [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, ..] => InspectPng(bytes),
        [0x52, 0x49, 0x46, 0x46, ..] => InspectWebP(bytes),
        [_, _, _, _, 0x66, 0x74, 0x79, 0x70, ..] => InspectHeic(bytes),
        _ => null,
    };

    // After the signature comes the IHDR chunk (13 bytes: the width and height as 32-bit big-endian numbers), then more chunks. The
    // file counts as a PNG only when every chunk up to the first IDAT (the image data) fits inside the file, so a cut-off or
    // self-contradicting file gives no answer.
    private static ImageFacts? InspectPng(ReadOnlySpan<byte> bytes)
    {
        const int SignatureSize = 8;
        const int HeaderDataSize = 13;
        var chunks = new ChunkReader(bytes[SignatureSize..], ChunkLayout.Png);
        if (!chunks.Next(out var type, out var header) || !type.SequenceEqual("IHDR"u8) || header.Length != HeaderDataSize)
        {
            return null;
        }

        var width = BinaryPrimitives.ReadUInt32BigEndian(header);
        var height = BinaryPrimitives.ReadUInt32BigEndian(header[4..]);
        if (!IsPlausibleSide(width) || !IsPlausibleSide(height))
        {
            return null;
        }

        while (chunks.Next(out type, out _))
        {
            if (type.SequenceEqual("IDAT"u8))
            {
                return new ImageFacts(ImageKind.Png, (int)width, (int)height, 1);
            }

            if (type.SequenceEqual("IEND"u8))
            {
                return null;
            }
        }

        return null;
    }

    // A side of 0 is no picture, and the PNG format itself caps a side at 2^31 - 1.
    private static bool IsPlausibleSide(uint side) => side is >= 1 and <= int.MaxValue;

    // RIFF, a little-endian size, WEBP, then chunks. A still file starts with a VP8 (lossy) or VP8L (lossless) chunk, or with a VP8X
    // chunk that holds the canvas size and flags. Animated files are refused: the shop only wants single photos.
    private static ImageFacts? InspectWebP(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < WebPHeaderSize || !bytes.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return null;
        }

        var end = 8L + BinaryPrimitives.ReadUInt32LittleEndian(bytes[4..]);
        if (end < WebPHeaderSize || end > bytes.Length)
        {
            return null;
        }

        var chunks = new ChunkReader(bytes[WebPHeaderSize..(int)end], ChunkLayout.WebP);
        if (!chunks.Next(out var type, out var data))
        {
            return null;
        }

        if (type.SequenceEqual("VP8 "u8))
        {
            return ReadWebPLossy(data);
        }

        if (type.SequenceEqual("VP8L"u8))
        {
            return ReadWebPLossless(data);
        }

        return type.SequenceEqual("VP8X"u8) ? ReadWebPExtended(data, ref chunks) : null;
    }

    // The frame tag is 3 bytes (bit 0 is 0 for a key frame), then the start code 9D 01 2A and two 14-bit sides.
    private static ImageFacts? ReadWebPLossy(ReadOnlySpan<byte> data)
    {
        if (data.Length < 10 || (data[0] & 1) != 0 || !data.Slice(3, 3).SequenceEqual((ReadOnlySpan<byte>)[0x9D, 0x01, 0x2A]))
        {
            return null;
        }

        var width = BinaryPrimitives.ReadUInt16LittleEndian(data[6..]) & 0x3FFF;
        var height = BinaryPrimitives.ReadUInt16LittleEndian(data[8..]) & 0x3FFF;
        return width == 0 || height == 0 ? null : new ImageFacts(ImageKind.WebP, width, height, 1);
    }

    // The signature byte 2F, then 14 bits of width - 1, 14 bits of height - 1, an alpha bit and a 3-bit version that must be 0.
    private static ImageFacts? ReadWebPLossless(ReadOnlySpan<byte> data)
    {
        if (data.Length < 5 || data[0] != 0x2F)
        {
            return null;
        }

        var bits = BinaryPrimitives.ReadUInt32LittleEndian(data[1..]);
        return bits >> 29 != 0 ? null : new ImageFacts(ImageKind.WebP, (int)(bits & 0x3FFF) + 1, (int)((bits >> 14) & 0x3FFF) + 1, 1);
    }

    // The VP8X chunk holds flags, then the canvas width - 1 and height - 1 as 24-bit numbers. An ANIM or ANMF chunk also means animation.
    private static ImageFacts? ReadWebPExtended(ReadOnlySpan<byte> data, ref ChunkReader chunks)
    {
        if (data.Length < 10 || (data[0] & WebPAnimationFlag) != 0)
        {
            return null;
        }

        var width = 1 + data[4] + (data[5] << 8) + (data[6] << 16);
        var height = 1 + data[7] + (data[8] << 8) + (data[9] << 16);
        while (chunks.Next(out var type, out var chunk))
        {
            if (type.SequenceEqual("ANIM"u8) || type.SequenceEqual("ANMF"u8))
            {
                return null;
            }

            var lossy = type.SequenceEqual("VP8 "u8);
            if (lossy || type.SequenceEqual("VP8L"u8))
            {
                var image = lossy ? ReadWebPLossy(chunk) : ReadWebPLossless(chunk);
                return image is null ? null : new ImageFacts(ImageKind.WebP, width, height, 1);
            }
        }

        return null;
    }

    // ISO base media boxes: ftyp first, whose brands tell HEIC from AVIF, then the meta box that names the primary image item (pitm)
    // and its properties (iprp). The size comes from that item's ispe property and its turn from its irot property. Nothing is decoded.
    private static ImageFacts? InspectHeic(ReadOnlySpan<byte> bytes)
    {
        var boxes = new ChunkReader(bytes, ChunkLayout.Box);
        if (!boxes.Next(out var type, out var payload) || !type.SequenceEqual("ftyp"u8) || !IsHeicBrandList(payload))
        {
            return null;
        }

        while (boxes.Next(out type, out payload))
        {
            if (type.SequenceEqual("meta"u8))
            {
                return ReadHeicMeta(payload);
            }
        }

        return null;
    }

    // The major brand, a minor version, then compatible brands. Any AVIF brand refuses the file; a HEIC brand is needed to accept it,
    // because the generic brands mif1 and msf1 are shared with AVIF.
    private static bool IsHeicBrandList(ReadOnlySpan<byte> ftyp)
    {
        var heic = false;
        for (var offset = 0; offset + 4 <= ftyp.Length; offset += offset == 0 ? 8 : 4)
        {
            var brand = ftyp.Slice(offset, 4);
            if (HasBrand("avifavis"u8, brand))
            {
                return false;
            }

            heic |= HasBrand("heicheixhevchevxheimheis"u8, brand);
        }

        return heic;
    }

    private static bool HasBrand(ReadOnlySpan<byte> list, ReadOnlySpan<byte> brand)
    {
        for (var offset = 0; offset < list.Length; offset += 4)
        {
            if (list.Slice(offset, 4).SequenceEqual(brand))
            {
                return true;
            }
        }

        return false;
    }

    // meta is a full box (4 bytes of version and flags) of child boxes.
    private static ImageFacts? ReadHeicMeta(ReadOnlySpan<byte> meta)
    {
        if (meta.Length < 4)
        {
            return null;
        }

        ReadOnlySpan<byte> pitm = default;
        ReadOnlySpan<byte> iprp = default;
        var children = new ChunkReader(meta[4..], ChunkLayout.Box);
        while ((pitm.IsEmpty || iprp.IsEmpty) && children.Next(out var type, out var payload))
        {
            if (type.SequenceEqual("pitm"u8))
            {
                pitm = payload;
            }
            else if (type.SequenceEqual("iprp"u8))
            {
                iprp = payload;
            }
        }

        if (!TryReadPrimaryItem(pitm, out var primary))
        {
            return null;
        }

        ReadOnlySpan<byte> ipco = default;
        ReadOnlySpan<byte> ipma = default;
        var properties = new ChunkReader(iprp, ChunkLayout.Box);
        while ((ipco.IsEmpty || ipma.IsEmpty) && properties.Next(out var type, out var payload))
        {
            if (type.SequenceEqual("ipco"u8))
            {
                ipco = payload;
            }
            else if (type.SequenceEqual("ipma"u8))
            {
                ipma = payload;
            }
        }

        Span<int> associated = stackalloc int[MaxAssociations];
        var count = ReadAssociations(ipma, primary, associated);
        return count > 0 ? ReadHeicProperties(ipco, associated[..count]) : null;
    }

    // pitm is a full box: version 0 holds a 16-bit item number, later versions a 32-bit one.
    private static bool TryReadPrimaryItem(ReadOnlySpan<byte> pitm, out uint item)
    {
        item = 0;
        if (pitm.Length < 6)
        {
            return false;
        }

        if (pitm[0] == 0)
        {
            item = BinaryPrimitives.ReadUInt16BigEndian(pitm[4..]);
            return true;
        }

        if (pitm.Length < 8)
        {
            return false;
        }

        item = BinaryPrimitives.ReadUInt32BigEndian(pitm[4..]);
        return true;
    }

    // ipma lists, per item, the 1-based indexes of the properties in ipco that belong to it. Returns how many were written to the
    // buffer for this item, or 0 when the item has none. Flag bit 0 makes each association 16 bits (15 bits of index) instead of 8 (7 bits).
    private static int ReadAssociations(ReadOnlySpan<byte> ipma, uint item, Span<int> indexes)
    {
        if (ipma.Length < 8)
        {
            return 0;
        }

        var wideIndex = (ipma[3] & 1) != 0;
        var itemSize = ipma[0] == 0 ? 2 : 4;
        var entries = BinaryPrimitives.ReadUInt32BigEndian(ipma[4..]);
        var position = 8;
        for (uint entry = 0; entry < Math.Min(entries, MaxItemEntries); entry++)
        {
            if (position + itemSize + 1 > ipma.Length)
            {
                return 0;
            }

            var id = itemSize == 2 ? BinaryPrimitives.ReadUInt16BigEndian(ipma[position..]) : BinaryPrimitives.ReadUInt32BigEndian(ipma[position..]);
            var count = ipma[position + itemSize];
            position += itemSize + 1;
            var width = wideIndex ? 2 : 1;
            if (position + (count * width) > ipma.Length)
            {
                return 0;
            }

            if (id != item)
            {
                position += count * width;
                continue;
            }

            for (var association = 0; association < count; association++)
            {
                indexes[association] = wideIndex
                    ? BinaryPrimitives.ReadUInt16BigEndian(ipma[(position + (association * 2))..]) & 0x7FFF
                    : ipma[position + association] & 0x7F;
            }

            return count;
        }

        return 0;
    }

    // Finds the item's ispe (full box: width and height as 32-bit numbers) and irot (one byte: quarter turns, counted in the order the
    // sniffer maps to Exif orientations 1, 6, 3 and 8) among the properties; the size stays as stored and the turn goes in Orientation.
    private static ImageFacts? ReadHeicProperties(ReadOnlySpan<byte> ipco, ReadOnlySpan<int> associated)
    {
        uint width = 0;
        uint height = 0;
        var orientation = 1;
        var properties = new ChunkReader(ipco, ChunkLayout.Box);
        for (var index = 1; properties.Next(out var type, out var payload); index++)
        {
            if (!associated.Contains(index))
            {
                continue;
            }

            if (type.SequenceEqual("ispe"u8) && width == 0 && payload.Length >= 12)
            {
                width = BinaryPrimitives.ReadUInt32BigEndian(payload[4..]);
                height = BinaryPrimitives.ReadUInt32BigEndian(payload[8..]);
            }
            else if (type.SequenceEqual("irot"u8) && payload.Length >= 1)
            {
                orientation = (payload[0] & 3) switch { 1 => 6, 2 => 3, 3 => 8, _ => 1 };
            }
        }

        return IsPlausibleSide(width) && IsPlausibleSide(height) ? new ImageFacts(ImageKind.Heic, (int)width, (int)height, orientation) : null;
    }

    // How the chunks or boxes of a format are laid out.
    private enum ChunkLayout
    {
        // A 32-bit big-endian length, the 4-letter type, the data, then a 4-byte checksum.
        Png,

        // The 4-letter type, a 32-bit little-endian length, the data, then one pad byte when the length is odd.
        WebP,

        // A 32-bit big-endian size that covers the 8-byte header, the 4-letter type, then the payload. A size of 1 means a 64-bit size
        // follows; a size of 0 or less than the header is refused.
        Box,
    }

    // The one bounded reader behind all the container formats. Every length is checked against what is left of the span, a length
    // that is wrong in any way ends the walk, and the walk stops after MaxChunks entries, so a hostile file cannot cause a read past the
    // end, a loop that does not advance, or a long scan.
    private ref struct ChunkReader
    {
        private readonly ReadOnlySpan<byte> _data;
        private readonly ChunkLayout _layout;
        private int _position;
        private int _count;

        public ChunkReader(ReadOnlySpan<byte> data, ChunkLayout layout)
        {
            _data = data;
            _layout = layout;
            _position = 0;
            _count = 0;
        }

        public bool Next(out ReadOnlySpan<byte> type, out ReadOnlySpan<byte> payload)
        {
            type = default;
            payload = default;
            if (_count >= MaxChunks || !TryMeasure(out var typeAt, out var payloadAt, out var payloadSize, out var total))
            {
                return false;
            }

            type = _data.Slice(_position + typeAt, 4);
            payload = _data.Slice(_position + payloadAt, payloadSize);
            _position += total;
            _count++;
            return true;
        }

        // Works out where the type and payload sit and how far the entry reaches, or fails when it does not fit in the span.
        private readonly bool TryMeasure(out int typeAt, out int payloadAt, out int payloadSize, out int total)
        {
            typeAt = 4;
            payloadAt = 8;
            payloadSize = 0;
            total = 0;
            var left = _data.Length - _position;
            switch (_layout)
            {
                case ChunkLayout.Png:
                    if (left < 12 || BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]) > left - 12)
                    {
                        return false;
                    }

                    payloadSize = (int)BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]);
                    total = payloadSize + 12;
                    return true;
                case ChunkLayout.WebP:
                    if (left < 8 || BinaryPrimitives.ReadUInt32LittleEndian(_data[(_position + 4)..]) > left - 8)
                    {
                        return false;
                    }

                    typeAt = 0;
                    payloadSize = (int)BinaryPrimitives.ReadUInt32LittleEndian(_data[(_position + 4)..]);
                    total = 8 + payloadSize + (payloadSize & 1);
                    return true;
                default:
                    return TryMeasureBox(left, out payloadAt, out payloadSize, out total);
            }
        }

        private readonly bool TryMeasureBox(int left, out int payloadAt, out int payloadSize, out int total)
        {
            payloadAt = 8;
            payloadSize = 0;
            total = 0;
            if (left < 8)
            {
                return false;
            }

            long size = BinaryPrimitives.ReadUInt32BigEndian(_data[_position..]);
            if (size == 1)
            {
                if (left < 16 || BinaryPrimitives.ReadUInt64BigEndian(_data[(_position + 8)..]) > int.MaxValue)
                {
                    return false;
                }

                size = (long)BinaryPrimitives.ReadUInt64BigEndian(_data[(_position + 8)..]);
                payloadAt = 16;
            }

            if (size < payloadAt || size > left)
            {
                return false;
            }

            payloadSize = (int)size - payloadAt;
            total = (int)size;
            return true;
        }
    }

    // Walks the segments up to the first frame header (SOF), which holds the size. The Exif block sits before it.
    private static ImageFacts? InspectJpeg(ReadOnlySpan<byte> bytes)
    {
        var position = 2;
        var orientation = 1;
        for (var segments = 0; segments < MaxSegments; segments++)
        {
            if (position >= bytes.Length || bytes[position] != 0xFF)
            {
                return null;
            }

            while (position < bytes.Length && bytes[position] == 0xFF)
            {
                position++;
            }

            if (position >= bytes.Length)
            {
                return null;
            }

            var marker = bytes[position++];
            if (marker is 0x00 or 0x01 or (>= 0xD0 and <= 0xD8))
            {
                continue;
            }

            // End of image, or the scan starts, before any frame header: there is no size to read.
            if (marker is 0xD9 or 0xDA || position + 2 > bytes.Length)
            {
                return null;
            }

            var length = BinaryPrimitives.ReadUInt16BigEndian(bytes[position..]);
            if (length < 2 || position + length > bytes.Length)
            {
                return null;
            }

            var payload = bytes.Slice(position + 2, length - 2);
            if (marker is >= 0xC0 and <= 0xCF and not (0xC4 or 0xC8 or 0xCC))
            {
                return ReadFrame(payload, orientation);
            }

            if (marker == 0xE1 && ReadExifOrientation(payload) is { } found)
            {
                orientation = found;
            }

            position += length;
        }

        return null;
    }

    // A frame header holds the precision, then the height and the width.
    private static ImageFacts? ReadFrame(ReadOnlySpan<byte> payload, int orientation)
    {
        if (payload.Length < 6)
        {
            return null;
        }

        var height = BinaryPrimitives.ReadUInt16BigEndian(payload[1..]);
        var width = BinaryPrimitives.ReadUInt16BigEndian(payload[3..]);
        return height == 0 || width == 0 ? null : new ImageFacts(ImageKind.Jpeg, width, height, orientation);
    }

    // Finds the Orientation tag in the first Exif directory; null when the block is missing, damaged or holds a value outside 1 to 8.
    private static int? ReadExifOrientation(ReadOnlySpan<byte> payload)
    {
        if (payload.Length < ExifHeader.Length + 8 || !payload[..ExifHeader.Length].SequenceEqual(ExifHeader))
        {
            return null;
        }

        var tiff = payload[ExifHeader.Length..];
        bool little;
        switch ((tiff[0], tiff[1]))
        {
            case (0x49, 0x49):
                little = true;
                break;
            case (0x4D, 0x4D):
                little = false;
                break;
            default:
                return null;
        }

        if (ReadUInt16(tiff, 2, little) != 42)
        {
            return null;
        }

        var directory = (long)ReadUInt32(tiff, 4, little);
        if (directory + 2 > tiff.Length)
        {
            return null;
        }

        var count = ReadUInt16(tiff, (int)directory, little);
        for (var index = 0; index < count; index++)
        {
            var entry = directory + 2 + ((long)index * TiffEntrySize);
            if (entry + TiffEntrySize > tiff.Length)
            {
                return null;
            }

            if (ReadUInt16(tiff, (int)entry, little) != ExifOrientationTag)
            {
                continue;
            }

            var value = ReadUInt16(tiff, (int)entry + 8, little);
            var isShort = ReadUInt16(tiff, (int)entry + 2, little) == TiffShort && ReadUInt32(tiff, (int)entry + 4, little) == 1;
            return isShort && value is >= 1 and <= 8 ? value : null;
        }

        return null;
    }

    private static int ReadUInt16(ReadOnlySpan<byte> data, int offset, bool little) =>
        little ? BinaryPrimitives.ReadUInt16LittleEndian(data[offset..]) : BinaryPrimitives.ReadUInt16BigEndian(data[offset..]);

    private static uint ReadUInt32(ReadOnlySpan<byte> data, int offset, bool little) =>
        little ? BinaryPrimitives.ReadUInt32LittleEndian(data[offset..]) : BinaryPrimitives.ReadUInt32BigEndian(data[offset..]);
}
