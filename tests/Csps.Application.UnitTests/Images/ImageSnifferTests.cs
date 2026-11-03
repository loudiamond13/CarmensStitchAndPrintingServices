using System.Buffers.Binary;
using System.Diagnostics;
using Csps.Application.Images;
using Csps.Testing.Images;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-02, IMG-03, T-09-01, T-09-13, T-09-14: the sniffer reads the type, size and turn of a JPEG, PNG, WebP or HEIC from its bytes and gives no answer, never an exception, for anything else.</summary>
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

    [Theory]
    [InlineData(WebPKind.Lossy, 1024, 768)]
    [InlineData(WebPKind.Lossless, 300, 200)]
    [InlineData(WebPKind.Extended, 4000, 3000)]
    public void AWebPGivesItsKindAndStoredSizeForEachOfTheThreeHeaders(WebPKind kind, int width, int height)
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.WebP(kind, width, height)).ShouldNotBeNull();

        facts.Kind.ShouldBe(ImageKind.WebP);
        facts.Width.ShouldBe(width);
        facts.Height.ShouldBe(height);
        facts.Orientation.ShouldBe(1);
    }

    [Fact]
    public void ALosslessWebPAtItsBiggestSizeIsRead()
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.WebP(WebPKind.Lossless, 16384, 16384)).ShouldNotBeNull();

        facts.Width.ShouldBe(16384);
        facts.Height.ShouldBe(16384);
    }

    [Fact]
    public void AnExtendedWebPWithColourProfileAndAlphaChunksBeforeTheImageIsRead()
    {
        var file = SyntheticImages.WebP(
            WebPKind.Extended,
            640,
            480,
            0x30,
            SyntheticImages.WebPChunk("ICCP", new byte[5]),
            SyntheticImages.WebPChunk("ALPH", new byte[8]));

        var facts = ImageSniffer.Inspect(file).ShouldNotBeNull();

        facts.Width.ShouldBe(640);
        facts.Height.ShouldBe(480);
    }

    [Fact]
    public void AnAnimatedWebPIsRefusedWhetherTheFlagOrTheChunkSaysSo()
    {
        var flagged = SyntheticImages.WebP(WebPKind.Extended, 400, 300, SyntheticImages.WebPAnimation);
        var withChunk = SyntheticImages.WebP(WebPKind.Extended, 400, 300, 0, SyntheticImages.WebPChunk("ANIM", new byte[6]));
        var withFrame = SyntheticImages.WebP(WebPKind.Extended, 400, 300, 0, SyntheticImages.WebPChunk("ANMF", new byte[16]));

        ImageSniffer.Inspect(flagged).ShouldBeNull();
        ImageSniffer.Inspect(withChunk).ShouldBeNull();
        ImageSniffer.Inspect(withFrame).ShouldBeNull();
    }

    [Fact]
    public void AWebPWithADamagedHeaderGivesNoAnswer()
    {
        var wrongForm = SyntheticImages.WebP(WebPKind.Lossy, 640, 480);
        wrongForm[8] = (byte)'X';
        var unknownFirstChunk = SyntheticImages.WebP(WebPKind.Lossy, 640, 480);
        unknownFirstChunk[12] = (byte)'Z';
        var wrongStartCode = SyntheticImages.WebP(WebPKind.Lossy, 640, 480);
        wrongStartCode[23] = 0x00;
        var notAKeyFrame = SyntheticImages.WebP(WebPKind.Lossy, 640, 480);
        notAKeyFrame[20] |= 0x01;
        var wrongLosslessSignature = SyntheticImages.WebP(WebPKind.Lossless, 640, 480);
        wrongLosslessSignature[20] = 0x00;
        var shortLossless = SyntheticImages.WebP(WebPKind.Lossless, 640, 480);
        shortLossless[16] = 4;
        var noImageChunk = SyntheticImages.WebP(WebPKind.Extended, 640, 480)[..30];
        noImageChunk[4] = 22;

        ImageSniffer.Inspect(SyntheticImages.WebP(WebPKind.Lossy, 0, 480)).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.WebP(WebPKind.Lossy, 640, 0)).ShouldBeNull();
        ImageSniffer.Inspect(wrongForm).ShouldBeNull();
        ImageSniffer.Inspect(unknownFirstChunk).ShouldBeNull();
        ImageSniffer.Inspect(wrongStartCode).ShouldBeNull();
        ImageSniffer.Inspect(notAKeyFrame).ShouldBeNull();
        ImageSniffer.Inspect(wrongLosslessSignature).ShouldBeNull();
        ImageSniffer.Inspect(shortLossless).ShouldBeNull();
        ImageSniffer.Inspect(noImageChunk).ShouldBeNull();
    }

    [Fact]
    public void AWebPCutShortGivesNoAnswer()
    {
        foreach (var kind in new[] { WebPKind.Lossy, WebPKind.Lossless, WebPKind.Extended })
        {
            var whole = SyntheticImages.WebP(kind, 640, 480);
            for (var length = 0; length < whole.Length; length++)
            {
                ImageSniffer.Inspect(whole.AsSpan(0, length)).ShouldBeNull($"{kind} cut to {length}");
            }
        }
    }

    [Fact]
    public void AHeicGivesItsKindAndStoredSize()
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.Heic(4032, 3024)).ShouldNotBeNull();

        facts.Kind.ShouldBe(ImageKind.Heic);
        facts.Width.ShouldBe(4032);
        facts.Height.ShouldBe(3024);
        facts.Orientation.ShouldBe(1);
        facts.UprightWidth.ShouldBe(4032);
        facts.UprightHeight.ShouldBe(3024);
    }

    [Theory]
    [InlineData(0, 1, 4032, 3024)]
    [InlineData(1, 6, 3024, 4032)]
    [InlineData(2, 3, 4032, 3024)]
    [InlineData(3, 8, 3024, 4032)]
    public void AHeicQuarterTurnSwapsTheUprightSizeThroughTheMatchingExifOrientation(int rotation, int orientation, int uprightWidth, int uprightHeight)
    {
        var facts = ImageSniffer.Inspect(SyntheticImages.Heic(4032, 3024, rotation)).ShouldNotBeNull();

        facts.Width.ShouldBe(4032);
        facts.Height.ShouldBe(3024);
        facts.Orientation.ShouldBe(orientation);
        facts.UprightWidth.ShouldBe(uprightWidth);
        facts.UprightHeight.ShouldBe(uprightHeight);
    }

    [Fact]
    public void AHeicTurnComesFromTheRotationPropertyAloneNotFromAnExifItem()
    {
        ImageSniffer.Inspect(SyntheticImages.Heic(4032, 3024, exifOrientation: 6)).ShouldNotBeNull().Orientation.ShouldBe(1);
        ImageSniffer.Inspect(SyntheticImages.Heic(4032, 3024, 1, exifOrientation: 6)).ShouldNotBeNull().UprightWidth.ShouldBe(3024);
    }

    [Theory]
    [InlineData("heic")]
    [InlineData("heix")]
    [InlineData("hevc")]
    [InlineData("hevx")]
    [InlineData("heim")]
    [InlineData("heis")]
    public void EachHeicBrandIsAcceptedAsTheMajorBrand(string brand)
    {
        ImageSniffer.Inspect(SyntheticImages.Heic(640, 480, brands: [brand])).ShouldNotBeNull().Kind.ShouldBe(ImageKind.Heic);
    }

    [Theory]
    [InlineData("mif1", "heic")]
    [InlineData("msf1", "hevc")]
    [InlineData("mif1", "miaf", "heix")]
    [InlineData("heic", "mif1")]
    public void AGenericBrandCountsOnlyBesideAHeicBrand(params string[] brands)
    {
        ImageSniffer.Inspect(SyntheticImages.Heic(640, 480, brands: brands)).ShouldNotBeNull().Kind.ShouldBe(ImageKind.Heic);
    }

    [Theory]
    [InlineData("mif1")]
    [InlineData("msf1")]
    [InlineData("mif1", "miaf")]
    [InlineData("avif")]
    [InlineData("avis")]
    [InlineData("mif1", "avif")]
    [InlineData("msf1", "avis")]
    [InlineData("avif", "mif1", "miaf")]
    [InlineData("heic", "avif")]
    [InlineData("mif1", "heic", "avis")]
    [InlineData("mp41", "isom")]
    public void AvifAndLookAlikeBrandsAreRefused(params string[] brands)
    {
        ImageSniffer.Inspect(SyntheticImages.Heic(640, 480, brands: brands)).ShouldBeNull();
    }

    [Fact]
    public void AnAvifFileIsRefused()
    {
        ImageSniffer.Inspect(SyntheticImages.Avif()).ShouldBeNull();
    }

    [Fact]
    public void AHeicWhosePrimaryItemIsNotTheFirstItemReadsThePrimaryItemSize()
    {
        var file = HeicFile(
            SyntheticImages.FullBox("pitm", 1, 0, U32(2)),
            SyntheticImages.Box("ipco", Ispe(10, 10), Ispe(200, 100)),
            SyntheticImages.FullBox("ipma", 0, 0, U32(2), [0x00, 0x01, 0x01, 0x01], [0x00, 0x02, 0x01, 0x02]));

        var facts = ImageSniffer.Inspect(file).ShouldNotBeNull();

        facts.Width.ShouldBe(200);
        facts.Height.ShouldBe(100);
    }

    [Fact]
    public void AHeicWithWideItemNumbersAndWidePropertyIndexesIsRead()
    {
        var file = HeicFile(
            SyntheticImages.FullBox("pitm", 1, 0, U32(70000)),
            SyntheticImages.Box("ipco", SyntheticImages.Box("free", [0x00]), Ispe(320, 240), SyntheticImages.Box("irot", [0x03])),
            SyntheticImages.FullBox("ipma", 1, 1, U32(1), U32(70000), [0x02], [0x80, 0x02], [0x00, 0x03]));

        var facts = ImageSniffer.Inspect(file).ShouldNotBeNull();

        facts.Width.ShouldBe(320);
        facts.Height.ShouldBe(240);
        facts.Orientation.ShouldBe(8);
    }

    [Fact]
    public void ABoxWithA64BitSizeAndBoxesBeforeTheMetaBoxAreRead()
    {
        var meta = SyntheticImages.FullBox(
            "meta",
            0,
            0,
            SyntheticImages.Box("free", new byte[20]),
            SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]),
            SyntheticImages.Box("iprp", SyntheticImages.Box("ipco", Ispe(640, 480)), SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x01, 0x81])));
        byte[] wideMeta = [0x00, 0x00, 0x00, 0x01, .. "meta"u8, .. U64(meta.Length + 8), .. meta[8..]];
        byte[] file = [.. SyntheticImages.Ftyp("heic", "mif1"), .. SyntheticImages.Box("mdat", new byte[40]), .. wideMeta];

        ImageSniffer.Inspect(file).ShouldNotBeNull().Width.ShouldBe(640);
    }

    [Fact]
    public void AHeicWhoseMetaBoxLacksWhatItNeedsGivesNoAnswer()
    {
        var pitm = SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]);
        var ipco = SyntheticImages.Box("ipco", Ispe(640, 480));
        var ipma = SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x01, 0x01]);

        HeicFileOf(SyntheticImages.Box("iprp", ipco, ipma)).ShouldBeNull("no pitm");
        HeicFileOf(pitm).ShouldBeNull("no iprp");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", ipco)).ShouldBeNull("no ipma");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", ipma)).ShouldBeNull("no ipco");
        HeicFileOf(SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x09]), SyntheticImages.Box("iprp", ipco, ipma)).ShouldBeNull("primary item has no properties");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", ipco, SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x01, 0x05]))).ShouldBeNull("index past ipco");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", ipco, SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x01, 0x00]))).ShouldBeNull("index zero");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", SyntheticImages.Box("ipco", SyntheticImages.Box("free", [0x00])), ipma)).ShouldBeNull("no ispe");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", SyntheticImages.Box("ipco", Ispe(0, 480)), ipma)).ShouldBeNull("zero width");
        HeicFileOf(pitm, SyntheticImages.Box("iprp", SyntheticImages.Box("ipco", SyntheticImages.Box("ispe", [0x00, 0x00, 0x00, 0x00, 0x00])), ipma)).ShouldBeNull("short ispe");
        HeicFileOf(SyntheticImages.Box("pitm", [0x00, 0x00]), SyntheticImages.Box("iprp", ipco, ipma)).ShouldBeNull("short pitm");
        HeicFileOf(SyntheticImages.FullBox("pitm", 1, 0, [0x00, 0x01]), SyntheticImages.Box("iprp", ipco, ipma)).ShouldBeNull("short wide pitm");
    }

    [Fact]
    public void AnEmptyRotationPropertyIsIgnored()
    {
        var file = HeicFile(
            SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]),
            SyntheticImages.Box("ipco", Ispe(640, 480), SyntheticImages.Box("irot")),
            SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x02, 0x01, 0x02]));

        ImageSniffer.Inspect(file).ShouldNotBeNull().Orientation.ShouldBe(1);
    }

    [Fact]
    public void FilesOfOtherTypesAreRefusedWhateverTheyAreNamed()
    {
        ImageSniffer.Inspect(SyntheticImages.Svg()).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Gif()).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Bmp()).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Tiff()).ShouldBeNull();
        ImageSniffer.Inspect([]).ShouldBeNull();
        ImageSniffer.Inspect([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A]).ShouldBeNull();
        ImageSniffer.Inspect("RIFF\0\0\0\0WAVEfmt "u8).ShouldBeNull();
        ImageSniffer.Inspect("\0\0\0\u0018ftypmp42\0\0\0\0mp42isom"u8).ShouldBeNull();
        ImageSniffer.Inspect("\0\0\0\u0018xxxxheic\0\0\0\0mif1heic"u8).ShouldBeNull();
    }

    [Fact]
    public void APngWhoseChunkLengthRunsPastTheEndGivesNoAnswer()
    {
        var chunk = SyntheticImages.PngChunk("tEXt", new byte[4]);
        BinaryPrimitives.WriteUInt32BigEndian(chunk, 1_000_000);
        var huge = SyntheticImages.PngChunk("tEXt", new byte[4]);
        BinaryPrimitives.WriteUInt32BigEndian(huge, uint.MaxValue);

        ImageSniffer.Inspect(SyntheticImages.Png(800, 600, chunk)).ShouldBeNull();
        ImageSniffer.Inspect(SyntheticImages.Png(800, 600, huge)).ShouldBeNull();
    }

    [Fact]
    public void APngWithNoImageDataOrCutShortInsideItGivesNoAnswer()
    {
        var whole = SyntheticImages.Png(800, 600);
        var headerOnly = whole[..33];
        byte[] noData = [.. headerOnly, .. SyntheticImages.PngChunk("IEND", [])];
        var cutInsideData = SyntheticImages.Truncated(whole, whole.Length - 12 - 10);

        ImageSniffer.Inspect(headerOnly).ShouldBeNull();
        ImageSniffer.Inspect(noData).ShouldBeNull();
        ImageSniffer.Inspect(cutInsideData).ShouldBeNull();
        ImageSniffer.Inspect(whole).ShouldNotBeNull();
    }

    [Fact]
    public void APngWithManyChunksBeforeItsDataIsReadUpToTheCapAndNoFurther()
    {
        var chunk = SyntheticImages.PngChunk("tEXt", new byte[4]);

        ImageSniffer.Inspect(SyntheticImages.Png(800, 600, [.. Enumerable.Repeat(chunk, 400)])).ShouldNotBeNull();
        ImageSniffer.Inspect(SyntheticImages.Png(800, 600, [.. Enumerable.Repeat(chunk, 600)])).ShouldBeNull();
    }

    [Fact]
    public void AWebPWithManyChunksBeforeItsImageIsReadUpToTheCapAndNoFurther()
    {
        var chunk = SyntheticImages.WebPChunk("JUNK", new byte[4]);

        ImageSniffer.Inspect(SyntheticImages.WebP(WebPKind.Extended, 640, 480, 0, [.. Enumerable.Repeat(chunk, 400)])).ShouldNotBeNull();
        ImageSniffer.Inspect(SyntheticImages.WebP(WebPKind.Extended, 640, 480, 0, [.. Enumerable.Repeat(chunk, 600)])).ShouldBeNull();
    }

    [Fact]
    public void AWebPChunkWithAHugeLengthGivesNoAnswer()
    {
        var file = SyntheticImages.WebP(WebPKind.Lossy, 640, 480);
        BinaryPrimitives.WriteUInt32LittleEndian(file.AsSpan(16), uint.MaxValue);
        var extended = SyntheticImages.WebP(WebPKind.Extended, 640, 480);
        BinaryPrimitives.WriteUInt32LittleEndian(extended.AsSpan(30), uint.MaxValue);

        ImageSniffer.Inspect(file).ShouldBeNull();
        ImageSniffer.Inspect(extended).ShouldBeNull();
    }

    [Fact]
    public void AHeicWithManyBoxesInAContainerIsReadUpToTheCapAndNoFurther()
    {
        var free = SyntheticImages.Box("free", [0x00]);
        var pitm = SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]);
        var iprp = SyntheticImages.Box("iprp", SyntheticImages.Box("ipco", Ispe(640, 480)), SyntheticImages.FullBox("ipma", 0, 0, U32(1), [0x00, 0x01, 0x01, 0x01]));

        HeicFileOf([.. Enumerable.Repeat(free, 400), pitm, iprp]).ShouldNotBeNull();
        HeicFileOf([.. Enumerable.Repeat(free, 600), pitm, iprp]).ShouldBeNull();
    }

    [Fact]
    public void AHeicWithManyPropertiesBeforeTheSizeIsReadUpToTheCapAndNoFurther()
    {
        var free = SyntheticImages.Box("free", [0x00]);
        var pitm = SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]);

        byte[] Build(int before) => HeicFile(
            pitm,
            SyntheticImages.Box("ipco", [.. Enumerable.Repeat(free, before).SelectMany(box => box), .. Ispe(640, 480)]),
            SyntheticImages.FullBox("ipma", 0, 1, U32(1), [0x00, 0x01, 0x01], [(byte)((before + 1) >> 8), (byte)(before + 1)]));

        ImageSniffer.Inspect(Build(400)).ShouldNotBeNull();
        ImageSniffer.Inspect(Build(600)).ShouldBeNull();
    }

    [Fact]
    public void AHeicWithManyItemsBeforeThePrimaryOneIsReadUpToTheCapAndNoFurther()
    {
        byte[] Build(int others) => HeicFile(
            SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]),
            SyntheticImages.Box("ipco", Ispe(640, 480)),
            SyntheticImages.FullBox("ipma", 0, 0, U32(others + 1), [.. Enumerable.Range(0, others).SelectMany(_ => new byte[] { 0x00, 0x02, 0x00 }), 0x00, 0x01, 0x01, 0x01]));

        ImageSniffer.Inspect(Build(4000)).ShouldNotBeNull();
        ImageSniffer.Inspect(Build(5000)).ShouldBeNull();
    }

    [Fact]
    public void AHeicWithBoxesNestedFarPastTheDepthTheReaderFollowsGivesNoAnswer()
    {
        var nested = SyntheticImages.Box("free", [0x00]);
        for (var depth = 0; depth < 200; depth++)
        {
            nested = SyntheticImages.FullBox("meta", 0, 0, nested);
        }

        ImageSniffer.Inspect([.. SyntheticImages.Ftyp("heic", "mif1"), .. nested]).ShouldBeNull();
    }

    [Fact]
    public void ABoxWithAZeroTooSmallOrOutOfRangeSizeGivesNoAnswer()
    {
        var ftypLength = SyntheticImages.Ftyp("heic", "mif1").Length;
        var whole = SyntheticImages.Heic(4032, 3024);

        ImageSniffer.Inspect(WithSize(whole, 0, 0)).ShouldBeNull("ftyp size 0");
        ImageSniffer.Inspect(WithSize(whole, 0, 7)).ShouldBeNull("ftyp size 7");
        ImageSniffer.Inspect(WithSize(whole, 0, 4096)).ShouldBeNull("ftyp past the end");
        ImageSniffer.Inspect(WithSize(whole, ftypLength, 0)).ShouldBeNull("meta size 0");
        ImageSniffer.Inspect(WithSize(whole, ftypLength, 7)).ShouldBeNull("meta size 7");
        ImageSniffer.Inspect(WithSize(whole, ftypLength, 3)).ShouldBeNull("meta size 3");
        ImageSniffer.Inspect(WithSize(whole, ftypLength, 0x7FFFFFFF)).ShouldBeNull("meta past the end");
        ImageSniffer.Inspect(WithSize(whole, ftypLength, uint.MaxValue)).ShouldBeNull("meta size 4 GB");
        ImageSniffer.Inspect(WithSize(whole, ftypLength + 12, 0)).ShouldBeNull("first child size 0");
        ImageSniffer.Inspect(WithSize(whole, ftypLength + 12, 5)).ShouldBeNull("first child size 5");
    }

    [Fact]
    public void ABoxWithA64BitSizeThatIsHugeCutShortOrWrapsBackGivesNoAnswer()
    {
        var ftyp = SyntheticImages.Ftyp("heic", "mif1");
        byte[] ShortWide(ulong size)
        {
            var wide = new byte[8];
            BinaryPrimitives.WriteUInt64BigEndian(wide, size);
            return [.. ftyp, 0x00, 0x00, 0x00, 0x01, .. "meta"u8, .. wide, 0, 0, 0, 0];
        }

        ImageSniffer.Inspect(ShortWide(8)).ShouldBeNull("size under the 16-byte header");
        ImageSniffer.Inspect(ShortWide(ulong.MaxValue)).ShouldBeNull("size wraps back");
        ImageSniffer.Inspect(ShortWide(0x1_0000_0000)).ShouldBeNull("size over 4 GB");
        ImageSniffer.Inspect(ShortWide(5000)).ShouldBeNull("size past the end");
        ImageSniffer.Inspect([.. ftyp, 0x00, 0x00, 0x00, 0x01, .. "meta"u8, 0, 0]).ShouldBeNull("64-bit size cut off");
        ImageSniffer.Inspect(SyntheticImages.LoopingBox()).ShouldBeNull("looping box");
    }

    [Fact]
    public void EveryCutOfAFileShorterThanItsHeaderGivesNoAnswerAndNeverThrows()
    {
        var png = SyntheticImages.Png(800, 600);
        var heic = SyntheticImages.Heic(4032, 3024, 1);
        var heicHeaderEnd = heic.Length - 12;

        for (var length = 0; length < png.Length; length++)
        {
            ImageSniffer.Inspect(png.AsSpan(0, length)).ShouldBeNull($"png cut to {length}");
        }

        for (var length = 0; length < heicHeaderEnd; length++)
        {
            ImageSniffer.Inspect(SyntheticImages.Truncated(heic, length)).ShouldBeNull($"heic cut to {length}");
        }

        for (var length = heicHeaderEnd; length <= heic.Length; length++)
        {
            ImageSniffer.Inspect(SyntheticImages.Truncated(heic, length)).ShouldNotBeNull($"heic cut to {length}");
        }
    }

    [Fact]
    public void EveryHostileFileIsRefusedInUnderFiftyMilliseconds()
    {
        var chunk = SyntheticImages.PngChunk("tEXt", new byte[4]);
        BinaryPrimitives.WriteUInt32BigEndian(chunk, 1_000_000);
        var free = SyntheticImages.Box("free", [0x00]);
        var nested = free;
        for (var depth = 0; depth < 500; depth++)
        {
            nested = SyntheticImages.FullBox("meta", 0, 0, nested);
        }

        Dictionary<string, byte[]> hostile = new()
        {
            ["chunk past the end"] = SyntheticImages.Png(800, 600, chunk),
            ["many png chunks"] = SyntheticImages.Png(800, 600, [.. Enumerable.Repeat(SyntheticImages.PngChunk("tEXt", []), 20_000)]),
            ["many webp chunks"] = SyntheticImages.WebP(WebPKind.Extended, 640, 480, 0, [.. Enumerable.Repeat(SyntheticImages.WebPChunk("JUNK", []), 20_000)]),
            ["many heic boxes"] = [.. SyntheticImages.Ftyp("heic"), .. SyntheticImages.FullBox("meta", 0, 0, [.. Enumerable.Repeat(free, 20_000).SelectMany(box => box)])],
            ["deep nesting"] = [.. SyntheticImages.Ftyp("heic"), .. nested],
            ["looping box"] = SyntheticImages.LoopingBox(),
            ["huge ipma entry count"] = HeicFile(
                SyntheticImages.FullBox("pitm", 0, 0, [0x00, 0x01]),
                SyntheticImages.Box("ipco", Ispe(640, 480)),
                SyntheticImages.FullBox("ipma", 0, 0, U32(int.MaxValue), new byte[60_000])),
        };

        ImageSniffer.Inspect(SyntheticImages.Png(800, 600)).ShouldNotBeNull();
        ImageSniffer.Inspect(SyntheticImages.Heic(640, 480)).ShouldNotBeNull();
        foreach (var (name, file) in hostile)
        {
            var watch = Stopwatch.StartNew();
            var facts = ImageSniffer.Inspect(file);
            watch.Stop();

            facts.ShouldBeNull(name);
            watch.ElapsedMilliseconds.ShouldBeLessThan(50, name);
        }
    }

    [Fact]
    public void TwoThousandSeededRandomInputsNeverThrow()
    {
        var generator = new SeededBytes(0xC0FFEE);
        byte[][] starts =
        [
            [0xFF, 0xD8, 0xFF],
            [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52],
            [.. "RIFF"u8, 0x00, 0x10, 0x00, 0x00, .. "WEBP"u8],
            [0x00, 0x00, 0x00, 0x18, .. "ftyp"u8, .. "heic"u8],
        ];

        for (var round = 0; round < 2000; round++)
        {
            var file = generator.Bytes(generator.Next(4097));
            var start = round % 5 == 4 ? Array.Empty<byte>() : starts[round % 5];
            start.AsSpan(0, Math.Min(start.Length, file.Length)).CopyTo(file);

            var facts = ImageSniffer.Inspect(file);

            if (facts is not null)
            {
                facts.Width.ShouldBeGreaterThan(0);
                facts.Height.ShouldBeGreaterThan(0);
            }
        }
    }

    [Fact]
    public void TwoThousandSeededDamagedPhotosNeverThrow()
    {
        var generator = new SeededBytes(0xBADF00D);
        byte[][] samples =
        [
            Jpeg(640, 480, Exif(little: true, 6)),
            SyntheticImages.Png(800, 600, SyntheticImages.PngChunk("tEXt", new byte[9])),
            SyntheticImages.WebP(WebPKind.Lossy, 1024, 768),
            SyntheticImages.WebP(WebPKind.Lossless, 300, 200),
            SyntheticImages.WebP(WebPKind.Extended, 4000, 3000, 0x30, SyntheticImages.WebPChunk("ICCP", new byte[5])),
            SyntheticImages.Heic(4032, 3024, 1, exifOrientation: 6),
            SyntheticImages.Avif(),
        ];

        for (var round = 0; round < 2000; round++)
        {
            var file = (byte[])samples[round % samples.Length].Clone();
            for (var change = generator.Next(8) + 1; change > 0; change--)
            {
                file[generator.Next(file.Length)] = (byte)generator.Next(256);
            }

            var cut = round % 3 == 0 ? file.AsSpan(0, generator.Next(file.Length + 1)) : file;

            ImageSniffer.Inspect(cut)?.Width.ShouldBeGreaterThan(0);
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

    // A copy of the file with the 32-bit size field of the box at the given offset replaced.
    private static byte[] WithSize(byte[] file, int boxOffset, uint size)
    {
        var copy = (byte[])file.Clone();
        BinaryPrimitives.WriteUInt32BigEndian(copy.AsSpan(boxOffset), size);
        return copy;
    }

    private static byte[] U32(int value) => [(byte)(value >> 24), (byte)(value >> 16), (byte)(value >> 8), (byte)value];

    private static byte[] U64(int value) => [0, 0, 0, 0, .. U32(value)];

    private static byte[] Ispe(int width, int height) => SyntheticImages.FullBox("ispe", 0, 0, U32(width), U32(height));

    // ftyp, then a meta box holding the given primary item box and the property container and association boxes.
    private static byte[] HeicFile(byte[] pitm, byte[] ipco, byte[] ipma) =>
        [.. SyntheticImages.Ftyp("heic", "mif1"), .. SyntheticImages.FullBox("meta", 0, 0, pitm, SyntheticImages.Box("iprp", ipco, ipma))];

    private static ImageFacts? HeicFileOf(params byte[][] metaChildren) =>
        ImageSniffer.Inspect([.. SyntheticImages.Ftyp("heic", "mif1"), .. SyntheticImages.FullBox("meta", 0, 0, metaChildren)]);

    // A small fixed-seed xorshift generator, so a failing input can be rebuilt exactly.
    private sealed class SeededBytes(uint seed)
    {
        private uint state = seed;

        public int Next(int maxExclusive)
        {
            state ^= state << 13;
            state ^= state >> 17;
            state ^= state << 5;
            return (int)(state % (uint)maxExclusive);
        }

        public byte[] Bytes(int length)
        {
            var bytes = new byte[length];
            for (var index = 0; index < length; index++)
            {
                bytes[index] = (byte)Next(256);
            }

            return bytes;
        }
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
