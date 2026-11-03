using System.Buffers.Binary;

namespace Csps.Application.Images;

/// <summary>
/// Tells what a file is from its first bytes alone, without decoding it (IMG-02, T-09-01). The client's file name and content type are
/// never used. It reads the format, the stored size and the Exif orientation, checks every offset against the length of the file and
/// stops after a fixed number of segments, so a damaged or hostile file gives no answer instead of an exception or a long loop.
/// </summary>
public static class ImageSniffer
{
    private const int MaxSegments = 512;
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
        _ => null,
    };

    // The signature is followed at once by the IHDR chunk: a length of 13, the type, then the width and height as 32-bit big-endian numbers.
    private static ImageFacts? InspectPng(ReadOnlySpan<byte> bytes)
    {
        const int SignatureSize = 8;
        const int HeaderDataSize = 13;
        if (bytes.Length < SignatureSize + 8 + HeaderDataSize
            || BinaryPrimitives.ReadUInt32BigEndian(bytes[SignatureSize..]) != HeaderDataSize
            || !bytes.Slice(SignatureSize + 4, 4).SequenceEqual("IHDR"u8))
        {
            return null;
        }

        var width = BinaryPrimitives.ReadUInt32BigEndian(bytes[(SignatureSize + 8)..]);
        var height = BinaryPrimitives.ReadUInt32BigEndian(bytes[(SignatureSize + 12)..]);
        return IsPlausibleSide(width) && IsPlausibleSide(height) ? new ImageFacts(ImageKind.Png, (int)width, (int)height, 1) : null;
    }

    // A side of 0 is no picture, and the PNG format itself caps a side at 2^31 - 1.
    private static bool IsPlausibleSide(uint side) => side is >= 1 and <= int.MaxValue;

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
