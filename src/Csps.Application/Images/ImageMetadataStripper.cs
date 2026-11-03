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
            _ => null,
        };

        // The picture must still read the same: same format, size and turn.
        if (cleaned is null || ImageSniffer.Inspect(bytes) is not { } before || ImageSniffer.Inspect(cleaned) != before)
        {
            return Result.Failure<byte[]>(ImageErrors.Type(fileName));
        }

        return Result.Success(cleaned);
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
