using Csps.Domain.Common;

namespace Csps.Application.Images;

/// <summary>
/// Removes location and camera data from a photo before it leaves the server (D-02, IMG-03). The work is on the bytes only: nothing is
/// decoded and no package is used. What the picture needs is kept byte for byte, and the Exif orientation of a JPEG survives in a new
/// block that holds nothing else. Every offset is checked against the length of the file and the walks are capped, so a damaged or
/// hostile file is refused instead of causing an exception or a long loop. A file that cannot be cleaned is refused, never passed on.
/// </summary>
public static class ImageMetadataStripper
{
    private const int MaxSegments = 4096;
    private const int MinimalExifSize = 36;

    /// <summary>Removes the metadata from a photo.</summary>
    /// <param name="kind">The format the bytes were checked as.</param>
    /// <param name="bytes">The whole file.</param>
    /// <param name="fileName">The name the client sent; only shown in a message.</param>
    /// <returns>The cleaned file, or a 400 type error when the file cannot be cleaned safely.</returns>
    public static Result<byte[]> Strip(ImageKind kind, ReadOnlySpan<byte> bytes, string? fileName = null)
    {
        var cleaned = kind switch
        {
            ImageKind.Jpeg => StripJpeg(bytes),
            ImageKind.Png => StripPng(bytes),
            ImageKind.WebP => StripWebP(bytes),
            _ => null,
        };

        // The picture must still read the same: same format, size and turn.
        if (cleaned is null || ImageSniffer.Inspect(bytes) is not { } before || ImageSniffer.Inspect(cleaned) != before)
        {
            return Result.Failure<byte[]>(ImageErrors.Type(fileName));
        }

        return Result.Success(cleaned);
    }

    // After the signature, whole chunks (length, type, data and checksum) are copied when they are on the keep list. Every other
    // ancillary chunk goes (text, Exif, time and unknown ones), and so does everything after IEND. An unknown critical chunk or a file
    // that never reaches IEND is refused.
    private static byte[]? StripPng(ReadOnlySpan<byte> bytes)
    {
        const int SignatureSize = 8;
        if (bytes.Length < SignatureSize || !bytes[..SignatureSize].SequenceEqual((ReadOnlySpan<byte>)[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]))
        {
            return null;
        }

        var output = new byte[bytes.Length];
        bytes[..SignatureSize].CopyTo(output);
        var written = SignatureSize;
        var chunks = new ChunkReader(bytes[SignatureSize..], ChunkLayout.Png);
        while (chunks.Next(out var type, out _, out var start, out var length))
        {
            if (!IsType("IHDRPLTEIDATIENDtRNSgAMAcHRMsRGBiCCPsBITpHYs"u8, type))
            {
                // Bit 5 of the first letter is the "ancillary" bit: a critical chunk we do not know cannot be dropped.
                if ((type[0] & 0x20) == 0)
                {
                    return null;
                }

                continue;
            }

            bytes.Slice(SignatureSize + start, length).CopyTo(output.AsSpan(written));
            written += length;
            if (type.SequenceEqual("IEND"u8))
            {
                Array.Resize(ref output, written);
                return output;
            }
        }

        return null;
    }

    // After the RIFF header, whole chunks are copied except EXIF and 'XMP '; the VP8X chunk loses its EXIF and XMP flags; every chunk
    // is padded to an even length; the RIFF size is written again. Bytes after the RIFF size go. A chunk list that does not fill the
    // RIFF size exactly is refused.
    private static byte[]? StripWebP(ReadOnlySpan<byte> bytes)
    {
        const int HeaderSize = 12;
        const byte ExifAndXmpFlags = 0x0C;
        if (bytes.Length < HeaderSize || !bytes[..4].SequenceEqual("RIFF"u8) || !bytes.Slice(8, 4).SequenceEqual("WEBP"u8))
        {
            return null;
        }

        var end = 8L + System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(bytes[4..]);
        if (end < HeaderSize || end > bytes.Length)
        {
            return null;
        }

        var output = new byte[(int)end + 1];
        bytes[..HeaderSize].CopyTo(output);
        var written = HeaderSize;
        var chunks = new ChunkReader(bytes[HeaderSize..(int)end], ChunkLayout.WebP);
        while (chunks.Next(out var type, out var payload, out var start, out _))
        {
            if (type.SequenceEqual("EXIF"u8) || type.SequenceEqual("XMP "u8))
            {
                continue;
            }

            var size = 8 + payload.Length;
            bytes.Slice(HeaderSize + start, size).CopyTo(output.AsSpan(written));
            if (type.SequenceEqual("VP8X"u8) && payload.Length > 0)
            {
                output[written + 8] &= unchecked((byte)~ExifAndXmpFlags);
            }

            written += size + (payload.Length & 1);
        }

        if (!chunks.AtEnd)
        {
            return null;
        }

        System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(output.AsSpan(4), (uint)(written - 8));
        Array.Resize(ref output, written);
        return output;
    }

    // Whether a 4-letter type is in a list of 4-letter types written one after the other.
    private static bool IsType(ReadOnlySpan<byte> list, ReadOnlySpan<byte> type)
    {
        for (var offset = 0; offset < list.Length; offset += 4)
        {
            if (list.Slice(offset, 4).SequenceEqual(type))
            {
                return true;
            }
        }

        return false;
    }

    // Walks the segments: APP0, an ICC profile (APP2) and APP14 stay with the tables, frame and scans; Exif, XMP, APP13, every other
    // APPn and comments go; everything after the first end-of-image marker goes. A fresh Exif block holding only the orientation is
    // written before the first kept segment that is not APP0, and only when the orientation is not 1.
    private static byte[]? StripJpeg(ReadOnlySpan<byte> bytes)
    {
        if (bytes.Length < 4 || !bytes[..3].SequenceEqual((ReadOnlySpan<byte>)[0xFF, 0xD8, 0xFF]))
        {
            return null;
        }

        var output = new byte[bytes.Length + MinimalExifSize];
        output[0] = 0xFF;
        output[1] = 0xD8;
        var written = 2;
        var position = 2;
        var insertAt = -1;
        var orientation = 1;
        var sawFrame = false;
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
            if (marker == 0xD9)
            {
                insertAt = insertAt < 0 ? written : insertAt;
                output[written++] = 0xFF;
                output[written++] = 0xD9;
                return Finish(output, written, insertAt, orientation);
            }

            if (marker is 0x00 or 0x01 or (>= 0xD0 and <= 0xD8) || position + 2 > bytes.Length)
            {
                return null;
            }

            var length = (bytes[position] << 8) | bytes[position + 1];
            if (length < 2 || position + length > bytes.Length)
            {
                return null;
            }

            var payload = bytes.Slice(position + 2, length - 2);
            if (marker is >= 0xC0 and <= 0xCF and not (0xC4 or 0xC8 or 0xCC))
            {
                sawFrame = true;
            }

            if (marker == 0xE1 && !sawFrame && ImageSniffer.ReadExifOrientation(payload) is { } found)
            {
                orientation = found;
            }

            if (IsKept(marker, payload))
            {
                if (marker != 0xE0 && insertAt < 0)
                {
                    insertAt = written;
                }

                bytes.Slice(position - 2, length + 2).CopyTo(output.AsSpan(written));
                written += length + 2;
            }

            position += length;
            if (marker == 0xDA)
            {
                var scanEnd = FindScanEnd(bytes, position);
                if (scanEnd < 0)
                {
                    return null;
                }

                bytes[position..scanEnd].CopyTo(output.AsSpan(written));
                written += scanEnd - position;
                position = scanEnd;
            }
        }

        return null;
    }

    private static bool IsKept(byte marker, ReadOnlySpan<byte> payload) => marker switch
    {
        0xE1 or 0xFE => false,
        0xE2 => payload.StartsWith("ICC_PROFILE\0"u8),
        >= 0xE3 and <= 0xED or 0xEF => false,
        _ => true,
    };

    // The scan data runs on past stuffed bytes (FF 00), restart markers (FF D0 to FF D7) and fill bytes (FF FF) up to the next real
    // marker. Returns where that marker's run of FF bytes begins, or -1 when the file ends first.
    private static int FindScanEnd(ReadOnlySpan<byte> bytes, int start)
    {
        for (var index = start; index < bytes.Length; index++)
        {
            if (bytes[index] != 0xFF)
            {
                continue;
            }

            var next = index + 1;
            while (next < bytes.Length && bytes[next] == 0xFF)
            {
                next++;
            }

            if (next >= bytes.Length)
            {
                return -1;
            }

            if (bytes[next] is not (0x00 or (>= 0xD0 and <= 0xD7)))
            {
                return index;
            }

            index = next;
        }

        return -1;
    }

    // Writes the minimal Exif block (a little-endian TIFF header and one entry: Orientation, a SHORT) at the chosen place.
    private static byte[] Finish(byte[] output, int written, int insertAt, int orientation)
    {
        if (orientation != 1)
        {
            output.AsSpan(insertAt, written - insertAt).CopyTo(output.AsSpan(insertAt + MinimalExifSize));
            byte[] exif =
            [
                0xFF, 0xE1, 0x00, 0x22,
                0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
                0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
                0x01, 0x00,
                0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, (byte)orientation, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
            ];
            exif.CopyTo(output, insertAt);
            written += MinimalExifSize;
        }

        Array.Resize(ref output, written);
        return output;
    }
}
