using System.Buffers.Binary;

namespace Csps.Testing.Images;

/// <summary>
/// Builds tiny synthetic image files in test code (D-07). They have the right headers for the sniffer and are never real photos;
/// the fake GPS block says 0 N 0 E.
/// </summary>
public static class SyntheticImages
{
    /// <summary>The VP8X flag that marks an animated WebP.</summary>
    public const byte WebPAnimation = 0x02;

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

    /// <summary>Builds a one-frame GIF header, which no photo check may accept.</summary>
    /// <returns>The file bytes.</returns>
    public static byte[] Gif() => [.. "GIF89a"u8, 10, 0, 10, 0, 0x00, 0x00, 0x00, 0x3B];

    /// <summary>Builds a BMP header, which no photo check may accept.</summary>
    /// <returns>The file bytes.</returns>
    public static byte[] Bmp()
    {
        var file = new byte[54];
        "BM"u8.CopyTo(file);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(2), (uint)file.Length);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(10), 54);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(14), 40);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(18), 10);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(22), 10);
        return file;
    }

    /// <summary>Builds a little-endian TIFF header, which no photo check may accept.</summary>
    /// <returns>The file bytes.</returns>
    public static byte[] Tiff() => [0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];

    /// <summary>Builds a WebP file: RIFF, then one VP8, VP8L or VP8X header chunk that holds the size.</summary>
    /// <param name="kind">Which header chunk to write.</param>
    /// <param name="width">The stored width in pixels.</param>
    /// <param name="height">The stored height in pixels.</param>
    /// <param name="flags">The VP8X feature flags; <see cref="WebPAnimation"/> marks an animated file. Ignored for the other kinds.</param>
    /// <param name="chunks">Whole chunks (see <see cref="WebPChunk"/>). For VP8X they sit between the VP8X chunk and the image chunk, otherwise after the image chunk.</param>
    /// <returns>The file bytes.</returns>
    public static byte[] WebP(WebPKind kind, int width, int height, byte flags = 0, params byte[][] chunks)
    {
        ArgumentNullException.ThrowIfNull(chunks);
        var lossy = WebPChunk("VP8 ", [0x50, 0x00, 0x00, 0x9D, 0x01, 0x2A, (byte)width, (byte)(width >> 8), (byte)height, (byte)(height >> 8), 0x00, 0x00]);
        byte[][] body = kind switch
        {
            WebPKind.Lossy => [lossy, .. chunks],
            WebPKind.Lossless => [WebPChunk("VP8L", LosslessHeader(width, height)), .. chunks],
            _ => [WebPChunk("VP8X", ExtendedHeader(width, height, flags)), .. chunks, lossy],
        };
        var payload = body.SelectMany(chunk => chunk).ToArray();
        var file = new byte[12 + payload.Length];
        "RIFF"u8.CopyTo(file);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(4), (uint)(payload.Length + 4));
        "WEBP"u8.CopyTo(file.AsSpan(8));
        payload.CopyTo(file, 12);
        return file;
    }

    /// <summary>Builds one WebP chunk: the four-letter type, a little-endian length, the data and one pad byte when the length is odd.</summary>
    /// <param name="type">The four-letter chunk type.</param>
    /// <param name="data">The chunk data.</param>
    /// <returns>The chunk bytes.</returns>
    public static byte[] WebPChunk(string type, byte[] data)
    {
        ArgumentNullException.ThrowIfNull(data);
        var chunk = new byte[8 + data.Length + (data.Length % 2)];
        System.Text.Encoding.ASCII.GetBytes(type, chunk.AsSpan(0, 4));
        BinaryPrimitives.WriteUInt32LittleEndian(chunk.AsSpan(4), (uint)data.Length);
        data.CopyTo(chunk, 8);
        return chunk;
    }

    /// <summary>Builds a HEIC file as an iPhone writes it: ftyp, a meta box that names the primary item and its size (and turn, when given), and a small mdat.</summary>
    /// <param name="width">The stored width in pixels (the ispe property).</param>
    /// <param name="height">The stored height in pixels (the ispe property).</param>
    /// <param name="rotation">The irot angle, 0 to 3 quarter turns; null writes no irot property.</param>
    /// <param name="brands">The major brand first, then the compatible brands; defaults to heic and mif1.</param>
    /// <param name="exifOrientation">When set, adds an Exif item with this orientation, which the sniffer must ignore for HEIC.</param>
    /// <returns>The file bytes.</returns>
    public static byte[] Heic(int width, int height, int? rotation = null, string[]? brands = null, int? exifOrientation = null)
    {
        var ispe = FullBox("ispe", 0, 0, UInt32Be(width), UInt32Be(height));
        var hvcC = Box("hvcC", [0x01, 0x01, 0x60, 0x00, 0x00, 0x00]);
        byte[][] properties = rotation is { } turns ? [ispe, Box("irot", [(byte)turns]), hvcC] : [ispe, hvcC];
        byte[] associations = [.. Enumerable.Range(1, properties.Length).Select(index => (byte)(index | 0x80))];

        var items = new List<byte[]> { Infe(1, "hvc1") };
        var data = new List<byte[]> { Box("mdat", [0x00, 0x00, 0x00, 0x01]) };
        if (exifOrientation is { } orientation)
        {
            items.Add(Infe(2, "Exif"));
            data = [Box("mdat", [0x00, 0x00, 0x00, 0x00, .. ExifBlock(orientation)])];
        }

        byte[] meta = FullBox(
            "meta",
            0,
            0,
            FullBox("hdlr", 0, 0, [0, 0, 0, 0, .. "pict"u8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
            FullBox("pitm", 0, 0, [0x00, 0x01]),
            FullBox("iinf", 0, 0, [0x00, (byte)items.Count, .. items.SelectMany(item => item)]),
            Box("iprp", Box("ipco", [.. properties.SelectMany(property => property)]), FullBox("ipma", 0, 0, UInt32Be(1), [0x00, 0x01, (byte)properties.Length, .. associations])));

        var chosen = brands ?? ["heic", "mif1"];
        return [.. Ftyp(chosen), .. meta, .. data.SelectMany(box => box)];
    }

    /// <summary>Builds an AVIF file, which looks like a HEIC to a careless reader but must be refused.</summary>
    /// <param name="width">The stored width in pixels.</param>
    /// <param name="height">The stored height in pixels.</param>
    /// <returns>The file bytes.</returns>
    public static byte[] Avif(int width = 64, int height = 64) => Heic(width, height, brands: ["avif", "mif1", "miaf"]);

    /// <summary>Builds an ftyp box.</summary>
    /// <param name="brands">The major brand first, then the compatible brands.</param>
    /// <returns>The box bytes.</returns>
    public static byte[] Ftyp(params string[] brands)
    {
        ArgumentNullException.ThrowIfNull(brands);
        return Box("ftyp", System.Text.Encoding.ASCII.GetBytes(brands[0]), UInt32Be(0), [.. brands.Skip(1).SelectMany(brand => System.Text.Encoding.ASCII.GetBytes(brand))]);
    }

    /// <summary>Builds an ISO base media box: a big-endian size that covers the header, the four-letter type and the parts.</summary>
    /// <param name="type">The four-letter box type.</param>
    /// <param name="parts">The payload pieces, joined in order.</param>
    /// <returns>The box bytes.</returns>
    public static byte[] Box(string type, params byte[][] parts)
    {
        ArgumentNullException.ThrowIfNull(parts);
        var payload = parts.SelectMany(part => part).ToArray();
        var box = new byte[8 + payload.Length];
        BinaryPrimitives.WriteUInt32BigEndian(box, (uint)box.Length);
        System.Text.Encoding.ASCII.GetBytes(type, box.AsSpan(4, 4));
        payload.CopyTo(box, 8);
        return box;
    }

    /// <summary>Builds a box that starts with a version byte and three flag bytes.</summary>
    /// <param name="type">The four-letter box type.</param>
    /// <param name="version">The version.</param>
    /// <param name="flags">The 24-bit flags.</param>
    /// <param name="parts">The payload pieces after the version and flags.</param>
    /// <returns>The box bytes.</returns>
    public static byte[] FullBox(string type, int version, int flags, params byte[][] parts)
    {
        ArgumentNullException.ThrowIfNull(parts);
        return Box(type, [(byte)version, (byte)(flags >> 16), (byte)(flags >> 8), (byte)flags], [.. parts.SelectMany(part => part)]);
    }

    /// <summary>Gives the first bytes of a file, as a download that stopped early would.</summary>
    /// <param name="file">The whole file.</param>
    /// <param name="length">How many bytes to keep.</param>
    /// <returns>The first <paramref name="length"/> bytes.</returns>
    public static byte[] Truncated(byte[] file, int length)
    {
        ArgumentNullException.ThrowIfNull(file);
        return file[..length];
    }

    /// <summary>Builds a HEIC whose meta box holds a child that claims a 64-bit size so large it wraps back to before its own start.</summary>
    /// <returns>The file bytes.</returns>
    public static byte[] LoopingBox()
    {
        byte[] looping = [0x00, 0x00, 0x00, 0x01, .. "free"u8, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xF0];
        return [.. Ftyp("heic", "mif1"), .. FullBox("meta", 0, 0, looping)];
    }

    private static byte[] UInt32Be(int value)
    {
        var bytes = new byte[4];
        BinaryPrimitives.WriteUInt32BigEndian(bytes, (uint)value);
        return bytes;
    }

    private static byte[] Infe(int itemId, string itemType) =>
        FullBox("infe", 2, 0, [(byte)(itemId >> 8), (byte)itemId, 0x00, 0x00], System.Text.Encoding.ASCII.GetBytes(itemType), [0x00]);

    private static byte[] LosslessHeader(int width, int height)
    {
        var header = new byte[5];
        header[0] = 0x2F;
        BinaryPrimitives.WriteUInt32LittleEndian(header.AsSpan(1), (uint)(width - 1) | ((uint)(height - 1) << 14));
        return header;
    }

    private static byte[] ExtendedHeader(int width, int height, byte flags) =>
    [
        flags, 0x00, 0x00, 0x00,
        (byte)(width - 1), (byte)((width - 1) >> 8), (byte)((width - 1) >> 16),
        (byte)(height - 1), (byte)((height - 1) >> 8), (byte)((height - 1) >> 16),
    ];

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

/// <summary>Which header chunk a synthetic WebP carries.</summary>
public enum WebPKind
{
    /// <summary>A lossy file with a VP8 chunk.</summary>
    Lossy,

    /// <summary>A lossless file with a VP8L chunk.</summary>
    Lossless,

    /// <summary>An extended file with a VP8X chunk.</summary>
    Extended,
}
