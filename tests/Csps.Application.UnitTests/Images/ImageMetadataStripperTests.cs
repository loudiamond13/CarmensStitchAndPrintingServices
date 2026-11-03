using System.Text;
using Csps.Application.Images;
using Csps.Testing.Images;

namespace Csps.Application.UnitTests.Images;

/// <summary>D-02, IMG-03, T-09-31, T-09-32, T-09-33: location and camera data is removed from every photo kind before storage, the picture itself is untouched, and a file that cannot be cleaned is refused.</summary>
public sealed class ImageMetadataStripperTests
{
    private static readonly byte[] GpsPointerTag = [0x25, 0x88];

    [Fact]
    public void AJpegLosesEveryMetadataBlockAndKeepsTheOrientationInAMinimalExif()
    {
        var input = SyntheticImages.JpegWithMetadata(640, 480, orientation: 6);

        var output = Strip(ImageKind.Jpeg, input);

        output.AsSpan(0, 2).ToArray().ShouldBe([0xFF, 0xD8]);
        Markers(output).ShouldBe([0xE0, 0xE1, 0xE2, 0xEE, 0xDB, 0xC0, 0xDA]);
        Segment(output, 0xE1).ShouldBe(MinimalExif(6));
        AssertNoMetadata(output);
        Segment(output, 0xE2).ShouldBe([.. "ICC_PROFILE\0"u8, 0x01, 0x01, .. SyntheticImages.IccBody]);
        output.AsSpan(output.Length - 2).ToArray().ShouldBe([0xFF, 0xD9]);
        Count(output, [0xFF, 0xD9]).ShouldBe(1);
        output.AsSpan(output.Length - 2 - SyntheticImages.ScanData.Length, SyntheticImages.ScanData.Length).ToArray().ShouldBe(SyntheticImages.ScanData);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
        ImageSniffer.Inspect(output).ShouldNotBeNull().Orientation.ShouldBe(6);
    }

    [Fact]
    public void TheInputFixtureReallyCarriesEveryKindOfMetadata()
    {
        var input = SyntheticImages.JpegWithMetadata(640, 480, orientation: 6);

        Markers(input).ShouldBe([0xE0, 0xE1, 0xE1, 0xE1, 0xE2, 0xE2, 0xED, 0xFE, 0xEE, 0xDB, 0xC0, 0xDA]);
        Count(input, Encoding.ASCII.GetBytes(SyntheticImages.FakeSerial)).ShouldBeGreaterThanOrEqualTo(5);
        Count(input, GpsPointerTag).ShouldBeGreaterThanOrEqualTo(1);
    }

    [Fact]
    public void AJpegWithOrientationOneHasNoExifAtAll()
    {
        var input = SyntheticImages.JpegWithMetadata(640, 480, orientation: 1);

        var output = Strip(ImageKind.Jpeg, input);

        Markers(output).ShouldBe([0xE0, 0xE2, 0xEE, 0xDB, 0xC0, 0xDA]);
        AssertNoMetadata(output);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
    }

    [Fact]
    public void AJpegWithNoMetadataComesBackByteForByte()
    {
        var input = SyntheticImages.Jpeg(640, 480);

        Strip(ImageKind.Jpeg, input).ShouldBe(input);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(6)]
    [InlineData(8)]
    public void StrippingAJpegTwiceGivesTheSameBytesAsOnce(int orientation)
    {
        var once = Strip(ImageKind.Jpeg, SyntheticImages.JpegWithMetadata(640, 480, orientation));

        Strip(ImageKind.Jpeg, once).ShouldBe(once);
    }

    [Fact]
    public void APngLosesItsTextExifTimeAndUnknownChunksAndAnythingAfterIend()
    {
        var input = SyntheticImages.PngWithMetadata(800, 600);

        var output = Strip(ImageKind.Png, input);

        PngChunks(output).Select(chunk => chunk.Type).ShouldBe(SyntheticImages.PngKeptTypes);
        var inputChunks = PngChunks(input).ToDictionary(chunk => chunk.Type, chunk => chunk.Bytes);
        foreach (var kept in PngChunks(output))
        {
            kept.Bytes.ShouldBe(inputChunks[kept.Type], kept.Type);
        }

        PngChunks(output)[1].Bytes[^4..].ShouldBe([0xA1, 0xA1, 0xA1, 0xA1]);
        output.AsSpan(output.Length - 12).ToArray().ShouldBe(SyntheticImages.PngChunk("IEND", []));
        AssertNoMetadata(output);
        Count(output, "TRAILER"u8.ToArray()).ShouldBe(0);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
        Strip(ImageKind.Png, output).ShouldBe(output);
    }

    [Fact]
    public void ThePngFixtureReallyCarriesEveryKindOfMetadata()
    {
        var types = PngChunks(SyntheticImages.PngWithMetadata(800, 600)).Select(chunk => chunk.Type).ToList();

        types.ShouldContain("eXIf");
        types.ShouldContain("tEXt");
        types.ShouldContain("zTXt");
        types.ShouldContain("iTXt");
        types.ShouldContain("tIME");
        types.ShouldContain("prVt");
    }

    [Fact]
    public void APngWithNothingToRemoveComesBackByteForByte()
    {
        var input = SyntheticImages.Png(800, 600);

        Strip(ImageKind.Png, input).ShouldBe(input);
    }

    [Fact]
    public void APngWithAnUnknownCriticalChunkOrNoIendOrABrokenChunkIsRefused()
    {
        var whole = SyntheticImages.Png(800, 600, SyntheticImages.PngChunk("tEXt", new byte[4]));
        var unknownCritical = SyntheticImages.Png(800, 600, SyntheticImages.PngChunk("ABCD", new byte[4]));
        var noEnd = whole[..^12];
        var brokenLength = (byte[])whole.Clone();
        brokenLength[8 + 25 + 3] = 0xFF;

        ImageMetadataStripper.Strip(ImageKind.Png, unknownCritical).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.Png, noEnd).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.Png, brokenLength).IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void AWebPLosesItsExifAndXmpChunksClearsTheirFlagsAndKeepsTheRest()
    {
        var input = SyntheticImages.WebPWithMetadata(4000, 3000);

        var output = Strip(ImageKind.WebP, input);

        WebPChunks(output).Select(chunk => chunk.Type).ShouldBe(["VP8X", "ICCP", "VP8 "]);
        var inputChunks = WebPChunks(input);
        WebPChunks(output)[1].Bytes.ShouldBe(inputChunks.Single(chunk => chunk.Type == "ICCP").Bytes);
        WebPChunks(output)[2].Bytes.ShouldBe(inputChunks.Single(chunk => chunk.Type == "VP8 ").Bytes);
        output[20].ShouldBe((byte)0x30);
        BitConverter.ToUInt32(output, 4).ShouldBe((uint)(output.Length - 8));
        (output.Length % 2).ShouldBe(0);
        AssertNoMetadata(output);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
        Strip(ImageKind.WebP, output).ShouldBe(output);
    }

    [Fact]
    public void TheWebPFixtureReallyCarriesBothMetadataChunksAndTheirFlags()
    {
        var input = SyntheticImages.WebPWithMetadata(4000, 3000);

        WebPChunks(input).Select(chunk => chunk.Type).ShouldBe(["VP8X", "ICCP", "EXIF", "XMP ", "VP8 ", "EXIF"]);
        input[20].ShouldBe((byte)0x3C);
    }

    [Theory]
    [InlineData(WebPKind.Lossy)]
    [InlineData(WebPKind.Lossless)]
    [InlineData(WebPKind.Extended)]
    public void AWebPWithNothingToRemoveComesBackByteForByte(WebPKind kind)
    {
        var input = SyntheticImages.WebP(kind, 1024, 768);

        Strip(ImageKind.WebP, input).ShouldBe(input);
    }

    [Fact]
    public void AWebPWithAnExifFlagButNoExifChunkStillHasTheFlagCleared()
    {
        var input = SyntheticImages.WebP(WebPKind.Extended, 1024, 768, flags: 0x08);

        Strip(ImageKind.WebP, input)[20].ShouldBe((byte)0x00);
    }

    [Fact]
    public void AWebPWithBytesAfterItsRiffSizeLosesThem()
    {
        var input = SyntheticImages.WebP(WebPKind.Lossy, 1024, 768);

        Strip(ImageKind.WebP, [.. input, .. "TRAILER"u8]).ShouldBe(input);
    }

    [Fact]
    public void AWebPWithABrokenChunkOrRiffSizeIsRefused()
    {
        var whole = SyntheticImages.WebP(WebPKind.Extended, 1024, 768);
        var brokenChunk = (byte[])whole.Clone();
        brokenChunk[16] = 0xFF;
        var brokenRiff = (byte[])whole.Clone();
        brokenRiff[4] = 0xFF;
        var trailingBytes = SyntheticImages.WebP(WebPKind.Lossy, 1024, 768);
        trailingBytes = [.. trailingBytes, 0x01, 0x02, 0x03];
        BitConverter.TryWriteBytes(trailingBytes.AsSpan(4), (uint)(trailingBytes.Length - 8));

        ImageMetadataStripper.Strip(ImageKind.WebP, brokenChunk).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.WebP, brokenRiff).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.WebP, trailingBytes).IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void AFailureCarriesTheTypeCodeAndTheFileName()
    {
        var result = ImageMetadataStripper.Strip(ImageKind.Jpeg, [0xFF, 0xD8, 0xFF, 0xE1, 0x00], "phone.jpg");

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe(ImageErrors.TypeCode);
        result.Error.Message.ShouldStartWith("phone.jpg isn't a photo we can use.");
    }

    [Fact]
    public void BytesThatAreNotOfTheGivenKindAreRefused()
    {
        ImageMetadataStripper.Strip(ImageKind.Png, SyntheticImages.Jpeg(640, 480)).IsFailure.ShouldBeTrue();
    }

    private static byte[] Strip(ImageKind kind, byte[] input)
    {
        var result = ImageMetadataStripper.Strip(kind, input);
        result.IsSuccess.ShouldBeTrue();
        return result.Value;
    }

    private static void AssertNoMetadata(byte[] output)
    {
        foreach (var text in new[] { SyntheticImages.FakeSerial, SyntheticImages.FakeMake, SyntheticImages.FakeModel, SyntheticImages.FakeDateTaken, SyntheticImages.FakeOwner, "ns.adobe.com", "Photoshop", "8BIM", "MPF", "xmpmeta" })
        {
            Count(output, Encoding.ASCII.GetBytes(text)).ShouldBe(0, text);
        }

        Count(output, GpsPointerTag).ShouldBe(0);
    }

    // The marker of every segment before the end of the scan, in order.
    private static List<byte> Markers(byte[] file)
    {
        var markers = new List<byte>();
        var position = 2;
        while (position + 4 <= file.Length)
        {
            var marker = file[position + 1];
            markers.Add(marker);
            position += 2 + ((file[position + 2] << 8) | file[position + 3]);
            if (marker == 0xDA)
            {
                break;
            }
        }

        return markers;
    }

    // The payload of the first segment with this marker.
    private static byte[] Segment(byte[] file, byte marker)
    {
        var position = 2;
        while (position + 4 <= file.Length)
        {
            var length = (file[position + 2] << 8) | file[position + 3];
            if (file[position + 1] == marker)
            {
                return file[(position + 4)..(position + 2 + length)];
            }

            position += 2 + length;
        }

        throw new InvalidOperationException("No such segment.");
    }

    // Every PNG chunk after the signature, whole (length, type, data and checksum).
    private static List<(string Type, byte[] Bytes)> PngChunks(byte[] file)
    {
        var chunks = new List<(string, byte[])>();
        var position = 8;
        while (position + 12 <= file.Length)
        {
            var length = (int)System.Buffers.Binary.BinaryPrimitives.ReadUInt32BigEndian(file.AsSpan(position));
            var type = Encoding.ASCII.GetString(file, position + 4, 4);
            chunks.Add((type, file[position..(position + 12 + length)]));
            position += 12 + length;
            if (type == "IEND")
            {
                break;
            }
        }

        return chunks;
    }

    // Every WebP chunk after the RIFF header, whole (type, length, data and pad byte).
    private static List<(string Type, byte[] Bytes)> WebPChunks(byte[] file)
    {
        var chunks = new List<(string, byte[])>();
        var position = 12;
        while (position + 8 <= file.Length)
        {
            var length = (int)System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(file.AsSpan(position + 4));
            var whole = 8 + length + (length % 2);
            chunks.Add((Encoding.ASCII.GetString(file, position, 4), file[position..(position + whole)]));
            position += whole;
        }

        return chunks;
    }

    private static int Count(byte[] file, byte[] pattern)
    {
        var count = 0;
        for (var start = 0; start + pattern.Length <= file.Length; start++)
        {
            if (file.AsSpan(start, pattern.Length).SequenceEqual(pattern))
            {
                count++;
            }
        }

        return count;
    }

    // "Exif\0\0", a little-endian TIFF header and one directory holding only Orientation.
    private static byte[] MinimalExif(int orientation) =>
    [
        .. "Exif\0\0"u8,
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00,
        0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, (byte)orientation, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,
    ];
}
