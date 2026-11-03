using System.Buffers.Binary;

namespace Csps.Testing.Images;

/// <summary>
/// Builds tiny synthetic image files in test code (D-07). They have the right headers for the sniffer and are never real photos;
/// the fake GPS block says 0 N 0 E.
/// </summary>
public static class SyntheticImages
{
    private const int ExifOrientationTag = 0x0112;
    private const int ExifGpsPointerTag = 0x8825;
    private const int TiffShort = 3;
    private const int TiffLong = 4;
    private const int TiffAscii = 2;
    private const int TiffRational = 5;

    /// <summary>Builds a JPEG with the given size: SOI, an optional Exif block, one quantization table, a baseline frame header, a tiny scan and EOI.</summary>
    /// <param name="width">The stored width in pixels.</param>
    /// <param name="height">The stored height in pixels.</param>
    /// <param name="orientation">The Exif orientation, 1 to 8; a value other than 1 adds the Exif block.</param>
    /// <param name="withExif">True to add the Exif block (orientation and a fake GPS block at 0 N 0 E) even for orientation 1.</param>
    /// <returns>The file bytes.</returns>
    public static byte[] Jpeg(int width, int height, int orientation = 1, bool withExif = false)
    {
        using var file = new MemoryStream();
        file.Write([0xFF, 0xD8]);
        if (withExif || orientation != 1)
        {
            var exif = ExifBlock(orientation);
            file.Write([0xFF, 0xE1]);
            WriteUInt16(file, exif.Length + 2);
            file.Write(exif);
        }

        file.Write([0xFF, 0xDB]);
        WriteUInt16(file, 67);
        file.WriteByte(0);
        file.Write(new byte[64]);

        file.Write([0xFF, 0xC0]);
        WriteUInt16(file, 11);
        file.WriteByte(8);
        WriteUInt16(file, height);
        WriteUInt16(file, width);
        file.Write([0x01, 0x01, 0x11, 0x00]);

        file.Write([0xFF, 0xDA]);
        WriteUInt16(file, 8);
        file.Write([0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]);
        file.Write([0x12, 0x34, 0x56]);
        file.Write([0xFF, 0xD9]);
        return file.ToArray();
    }

    /// <summary>Builds a PNG with the given size: the signature, an IHDR chunk, any extra chunks, one tiny IDAT chunk and IEND. Chunk checksums are left at zero because the sniffer never reads them.</summary>
    /// <param name="width">The stored width in pixels.</param>
    /// <param name="height">The stored height in pixels.</param>
    /// <param name="chunks">Whole chunks (see <see cref="PngChunk"/>) placed between IHDR and IDAT.</param>
    /// <returns>The file bytes.</returns>
    public static byte[] Png(int width, int height, params byte[][] chunks)
    {
        using var file = new MemoryStream();
        file.Write([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        var header = new byte[13];
        BinaryPrimitives.WriteUInt32BigEndian(header, (uint)width);
        BinaryPrimitives.WriteUInt32BigEndian(header.AsSpan(4), (uint)height);
        header[8] = 8;
        header[9] = 2;
        file.Write(PngChunk("IHDR", header));
        foreach (var chunk in chunks)
        {
            file.Write(chunk);
        }

        file.Write(PngChunk("IDAT", [0x78, 0x01, 0x01, 0x00, 0x00, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x01]));
        file.Write(PngChunk("IEND", []));
        return file.ToArray();
    }

    /// <summary>Builds one PNG chunk: a big-endian length, the four-letter type, the data and a zero checksum.</summary>
    /// <param name="type">The four-letter chunk type.</param>
    /// <param name="data">The chunk data.</param>
    /// <returns>The chunk bytes.</returns>
    public static byte[] PngChunk(string type, byte[] data)
    {
        ArgumentNullException.ThrowIfNull(data);
        var chunk = new byte[data.Length + 12];
        BinaryPrimitives.WriteUInt32BigEndian(chunk, (uint)data.Length);
        System.Text.Encoding.ASCII.GetBytes(type, chunk.AsSpan(4, 4));
        data.CopyTo(chunk, 8);
        return chunk;
    }

    /// <summary>Builds a small SVG document, which no photo check may accept.</summary>
    /// <returns>The file bytes.</returns>
    public static byte[] Svg() => "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"></svg>"u8.ToArray();

    // "Exif\0\0", a little-endian TIFF header, IFD0 with Orientation and a pointer to a GPS block that says 0 N 0 E.
    private static byte[] ExifBlock(int orientation)
    {
        const int Ifd0Offset = 8;
        const int Ifd0Size = 2 + (2 * 12) + 4;
        const int GpsOffset = Ifd0Offset + Ifd0Size;
        const int GpsSize = 2 + (4 * 12) + 4;
        const int LatitudeOffset = GpsOffset + GpsSize;
        const int LongitudeOffset = LatitudeOffset + 24;

        using var tiff = new MemoryStream();
        tiff.Write([0x49, 0x49, 0x2A, 0x00]);
        WriteUInt32(tiff, Ifd0Offset);

        WriteUInt16Le(tiff, 2);
        WriteEntry(tiff, ExifOrientationTag, TiffShort, 1, (uint)orientation);
        WriteEntry(tiff, ExifGpsPointerTag, TiffLong, 1, GpsOffset);
        WriteUInt32(tiff, 0);

        WriteUInt16Le(tiff, 4);
        WriteEntry(tiff, 1, TiffAscii, 2, 'N');
        WriteEntry(tiff, 2, TiffRational, 3, LatitudeOffset);
        WriteEntry(tiff, 3, TiffAscii, 2, 'E');
        WriteEntry(tiff, 4, TiffRational, 3, LongitudeOffset);
        WriteUInt32(tiff, 0);

        for (var rational = 0; rational < 6; rational++)
        {
            WriteUInt32(tiff, rational % 2 == 0 ? 0u : 1u);
        }

        for (var rational = 0; rational < 6; rational++)
        {
            WriteUInt32(tiff, rational % 2 == 0 ? 0u : 1u);
        }

        return [.. "Exif\0\0"u8.ToArray(), .. tiff.ToArray()];
    }

    private static void WriteEntry(MemoryStream stream, int tag, int type, int count, uint value)
    {
        WriteUInt16Le(stream, tag);
        WriteUInt16Le(stream, type);
        WriteUInt32(stream, (uint)count);
        WriteUInt32(stream, value);
    }

    private static void WriteUInt16(MemoryStream stream, int value)
    {
        Span<byte> buffer = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16BigEndian(buffer, (ushort)value);
        stream.Write(buffer);
    }

    private static void WriteUInt16Le(MemoryStream stream, int value)
    {
        Span<byte> buffer = stackalloc byte[2];
        BinaryPrimitives.WriteUInt16LittleEndian(buffer, (ushort)value);
        stream.Write(buffer);
    }

    private static void WriteUInt32(MemoryStream stream, uint value)
    {
        Span<byte> buffer = stackalloc byte[4];
        BinaryPrimitives.WriteUInt32LittleEndian(buffer, value);
        stream.Write(buffer);
    }
}
