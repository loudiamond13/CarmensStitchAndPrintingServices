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
