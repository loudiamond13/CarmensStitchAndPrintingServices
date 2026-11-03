using Csps.Application.Images;
using Csps.Testing.Images;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-02, IMG-03, T-09-01: the sniffer reads a JPEG's size and orientation from its bytes and gives no answer, never an exception, for anything else.</summary>
public sealed class ImageSnifferTests
{
    [Fact]
    public void AJpegGivesItsKindAndStoredSize()
    {
        var facts = ImageSniffer.Inspect(Jpeg(640, 480)).ShouldNotBeNull();

        facts.Kind.ShouldBe(ImageKind.Jpeg);
        facts.Width.ShouldBe(640);
        facts.Height.ShouldBe(480);
        facts.Orientation.ShouldBe(1);
        facts.UprightWidth.ShouldBe(640);
        facts.UprightHeight.ShouldBe(480);
    }

    [Theory]
    [InlineData(1, 640, 480)]
    [InlineData(2, 640, 480)]
    [InlineData(3, 640, 480)]
    [InlineData(4, 640, 480)]
    [InlineData(5, 480, 640)]
    [InlineData(6, 480, 640)]
    [InlineData(7, 480, 640)]
    [InlineData(8, 480, 640)]
    public void TheUprightSizeSwapsForTheSidewaysOrientations(int orientation, int width, int height)
    {
        var facts = ImageSniffer.Inspect(Jpeg(640, 480, Exif(little: true, orientation))).ShouldNotBeNull();

        facts.Orientation.ShouldBe(orientation);
        facts.UprightWidth.ShouldBe(width);
        facts.UprightHeight.ShouldBe(height);
    }

    [Fact]
    public void ABigEndianExifBlockIsReadToo()
    {
        ImageSniffer.Inspect(Jpeg(640, 480, Exif(little: false, 8))).ShouldNotBeNull().Orientation.ShouldBe(8);
    }

    [Fact]
    public void AnOrientationOutsideOneToEightOrOfTheWrongTypeIsIgnored()
    {
        ImageSniffer.Inspect(Jpeg(640, 480, Exif(little: true, 9))).ShouldNotBeNull().Orientation.ShouldBe(1);
        ImageSniffer.Inspect(Jpeg(640, 480, Exif(little: true, 6, type: 4))).ShouldNotBeNull().Orientation.ShouldBe(1);
        ImageSniffer.Inspect(Jpeg(640, 480, Exif(little: true, 6, count: 2))).ShouldNotBeNull().Orientation.ShouldBe(1);
    }

    [Fact]
    public void ADamagedExifBlockIsIgnoredAndTheSizeIsStillRead()
    {
        var wrongHeader = Exif(little: true, 6);
        wrongHeader[0] = (byte)'X';
        var wrongByteOrder = Exif(little: true, 6);
        wrongByteOrder[6] = 0x00;
        var wrongMagic = Exif(little: true, 6);
        wrongMagic[8] = 0x2B;
        var directoryPastTheEnd = Exif(little: true, 6);
        directoryPastTheEnd[10] = 0xFF;
        directoryPastTheEnd[11] = 0xFF;
        var entriesPastTheEnd = Exif(little: true, 6);
        entriesPastTheEnd[14] = 0xFF;
        entriesPastTheEnd[16] = 0x13;
        var noOrientationTag = Exif(little: true, 6);
        noOrientationTag[16] = 0x13;

        foreach (var block in new[] { wrongHeader, wrongByteOrder, wrongMagic, directoryPastTheEnd, entriesPastTheEnd, noOrientationTag, Exif(little: true, 6)[..10] })
        {
            ImageSniffer.Inspect(Jpeg(640, 480, block)).ShouldNotBeNull().Orientation.ShouldBe(1);
        }
    }

    [Fact]
    public void FillBytesRestartMarkersAndOtherSegmentsBeforeTheFrameAreSkipped()
    {
        byte[] file =
        [
            0xFF, 0xD8,
            0xFF, 0xFF, 0xE0, 0x00, 0x04, 0x01, 0x02,
            0xFF, 0xD0,
            0xFF, 0xC4, 0x00, 0x03, 0x00,
            0xFF, 0xC2, 0x00, 0x0B, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00,
            0xFF, 0xD9,
        ];

        var facts = ImageSniffer.Inspect(file).ShouldNotBeNull();

        facts.Width.ShouldBe(640);
        facts.Height.ShouldBe(480);
    }

    [Fact]
    public void ABiggestPossibleSizeIsRead()
    {
        var facts = ImageSniffer.Inspect(Jpeg(65535, 65535)).ShouldNotBeNull();

        facts.Width.ShouldBe(65535);
        facts.Height.ShouldBe(65535);
    }

    [Fact]
    public void AnythingThatIsNotAJpegGivesNoAnswer()
    {
        ImageSniffer.Inspect([]).ShouldBeNull();
        ImageSniffer.Inspect([0xFF, 0xD8]).ShouldBeNull();
        ImageSniffer.Inspect("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"u8).ShouldBeNull();
        ImageSniffer.Inspect([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).ShouldBeNull();
        ImageSniffer.Inspect("GIF89a"u8).ShouldBeNull();
    }

    [Fact]
    public void APngGivesItsKindAndStoredSize()
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.Png(800, 600)).ShouldNotBeNull();

        facts.Kind.ShouldBe(ImageKind.Png);
        facts.Width.ShouldBe(800);
        facts.Height.ShouldBe(600);
        facts.Orientation.ShouldBe(1);
        facts.UprightWidth.ShouldBe(800);
        facts.UprightHeight.ShouldBe(600);
    }

    [Fact]
    public void ABiggestPossiblePngSizeIsRead()
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.Png(int.MaxValue, int.MaxValue)).ShouldNotBeNull();

        facts.Width.ShouldBe(int.MaxValue);
        facts.Height.ShouldBe(int.MaxValue);
    }

    [Fact]
    public void APngWithAnEmptyOrOversizedSideGivesNoAnswer()
    {
        ImageSniffer.Inspect(SyntheticImages.Png(0, 600)).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Png(800, 0)).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Png(unchecked((int)0x80000000), 600)).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Png(800, unchecked((int)0x80000000))).ShouldBeNull();
    }

    [Fact]
    public void APngWhoseFirstChunkIsNotAThirteenByteHeaderGivesNoAnswer()
    {
        var whole = SyntheticImages.Png(800, 600);
        var notHeader = (byte[])whole.Clone();
        notHeader[12] = (byte)'X';
        var shortHeader = (byte[])whole.Clone();
        shortHeader[11] = 12;

        ImageSniffer.Inspect(notHeader).ShouldBeNull();
        ImageSniffer.Inspect(shortHeader).ShouldBeNull();
    }

    [Fact]
    public void APngCutShortInsideItsHeaderGivesNoAnswer()
    {
        var whole = SyntheticImages.Png(800, 600);

        foreach (var length in new[] { 0, 7, 8, 12, 16, 28 })
        {
            ImageSniffer.Inspect(whole.AsSpan(0, length)).ShouldBeNull();
        }
    }

    [Fact]
    public void ADamagedJpegGivesNoAnswerAndNeverThrows()
    {
        var whole = Jpeg(640, 480);
        var truncatedHeader = whole[..(whole.Length - 20)];
        byte[][] damaged =
        [
            truncatedHeader,
            [0xFF, 0xD8, 0xFF, 0xE0],
            [0xFF, 0xD8, 0xFF, 0xE0, 0x00],
            [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x01, 0x00],
            [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x20, 0x00],
            [0xFF, 0xD8, 0xFF, 0xFF],
            [0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x05, 0x08, 0x01, 0xE0],
            [0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x00, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00],
            [0xFF, 0xD8, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x01, 0xE0, 0x00, 0x00, 0x01, 0x01, 0x11, 0x00],
            [0xFF, 0xD8, 0xFF, 0xD9],
            [0xFF, 0xD8, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00],
            [0xFF, 0xD8, 0xFF, 0x00, 0x12],
            [0xFF, 0xD8, 0xFF, 0xC8, 0x00, 0x0B, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00],
        ];

        foreach (var file in damaged)
        {
            ImageSniffer.Inspect(file).ShouldBeNull();
        }
    }

    [Fact]
    public void AFileWithManyEmptySegmentsAndNoFrameStopsAtTheSegmentCap()
    {
        var file = new List<byte> { 0xFF, 0xD8 };
        for (var segment = 0; segment < 600; segment++)
        {
            file.AddRange([0xFF, 0xE0, 0x00, 0x02]);
        }

        file.AddRange([0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00]);

        ImageSniffer.Inspect([.. file]).ShouldBeNull();
    }

    [Theory]
    [InlineData(ImageKind.Jpeg, "jpg")]
    [InlineData(ImageKind.Png, "png")]
    [InlineData(ImageKind.WebP, "webp")]
    [InlineData(ImageKind.Heic, "heic")]
    public void EachKindHasItsStoredName(ImageKind kind, string key)
    {
        ImageKinds.Key(kind).ShouldBe(key);
    }

    [Fact]
    public void AnUnknownKindIsRefused()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => ImageKinds.Key((ImageKind)99));
    }

    // SOI, an optional Exif segment, a quantization table, a baseline frame header, a tiny scan and EOI.
    private static byte[] Jpeg(int width, int height, byte[]? exif = null)
    {
        var file = new List<byte> { 0xFF, 0xD8 };
        if (exif is not null)
        {
            file.AddRange([0xFF, 0xE1, (byte)((exif.Length + 2) >> 8), (byte)(exif.Length + 2)]);
            file.AddRange(exif);
        }

        file.AddRange([0xFF, 0xDB, 0x00, 0x43, 0x00]);
        file.AddRange(new byte[64]);
        file.AddRange([0xFF, 0xC0, 0x00, 0x0B, 0x08, (byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width, 0x01, 0x01, 0x11, 0x00]);
        file.AddRange([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x12, 0x34, 0xFF, 0xD9]);
        return [.. file];
    }

    // "Exif\0\0", a TIFF header and one directory entry holding the Orientation tag.
    private static byte[] Exif(bool little, int orientation, int type = 3, int count = 1)
    {
        byte[] Two(int value) => little ? [(byte)value, (byte)(value >> 8)] : [(byte)(value >> 8), (byte)value];
        byte[] Four(int value) => little ? [(byte)value, (byte)(value >> 8), 0, 0] : [0, 0, (byte)(value >> 8), (byte)value];

        List<byte> block = [.. "Exif\0\0"u8.ToArray(), little ? (byte)0x49 : (byte)0x4D, little ? (byte)0x49 : (byte)0x4D];
        block.AddRange(Two(42));
        block.AddRange(Four(8));
        block.AddRange(Two(1));
        block.AddRange(Two(0x0112));
        block.AddRange(Two(type));
        block.AddRange(Four(count));
        block.AddRange(Two(orientation));
        block.AddRange([0, 0]);
        block.AddRange(Four(0));
        return [.. block];
    }
}
