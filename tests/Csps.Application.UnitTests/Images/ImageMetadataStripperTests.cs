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
        var inputChunks = PngChunks(input).GroupBy(chunk => chunk.Type).ToDictionary(group => group.Key, group => group.First().Bytes);
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

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void AHeicHasItsExifAndXmpPayloadsZeroedAndNoOtherByteChanged(bool useIdat)
    {
        var input = SyntheticImages.HeicWithMetadata(4032, 3024, rotation: 1, useIdat);

        var output = Strip(ImageKind.Heic, input);

        output.ShouldBe(Wiped(input));
        output.Length.ShouldBe(input.Length);
        Count(output, SyntheticImages.HeicImageData).ShouldBe(1);
        AssertNoMetadata(output);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
        ImageSniffer.Inspect(output).ShouldNotBeNull().Orientation.ShouldBe(6);
    }

    [Fact]
    public void TheHeicFixtureReallyHoldsTheMetadataItsPayloadsAreFoundIn()
    {
        var input = SyntheticImages.HeicWithMetadata(4032, 3024);

        input.AsSpan().IndexOf(SyntheticImages.HeicExifItem).ShouldBeGreaterThan(0);
        input.AsSpan().IndexOf(SyntheticImages.HeicXmpItem).ShouldBeGreaterThan(0);
        Count(input, Encoding.ASCII.GetBytes(SyntheticImages.FakeSerial)).ShouldBe(2);
        Count(input, GpsPointerTag).ShouldBe(1);
    }

    [Theory]
    [InlineData(0, 4, 4, 0, 0)]
    [InlineData(0, 4, 4, 4, 0)]
    [InlineData(1, 8, 8, 8, 0)]
    [InlineData(1, 4, 4, 0, 4)]
    [InlineData(2, 4, 4, 4, 0)]
    [InlineData(2, 8, 4, 0, 8)]
    public void AHeicIsCleanedWhateverTheWidthsOfItsLocationFields(int version, int offsetSize, int lengthSize, int baseOffsetSize, int indexSize)
    {
        var input = SyntheticImages.HeicWithLocations(
            StandardIinf,
            offsets => SyntheticImages.Iloc(version, offsetSize, lengthSize, baseOffsetSize, indexSize, Items(offsets, baseOffsetSize: baseOffsetSize)),
            null,
            StandardMdat);

        Strip(ImageKind.Heic, input).ShouldBe(Wiped(input));
    }

    [Fact]
    public void AHeicItemKeptInSeveralExtentsIsZeroedInAllOfThem()
    {
        var input = SyntheticImages.HeicWithLocations(
            StandardIinf,
            offsets =>
            {
                var exif = offsets.Mdat + SyntheticImages.HeicImageData.Length;
                return SyntheticImages.Iloc(
                    1,
                    4,
                    4,
                    0,
                    Image(offsets),
                    new IlocItem(2, 0, 0, 0, [new IlocExtent(exif, 10), new IlocExtent(exif + 10, SyntheticImages.HeicExifItem.Length - 10)]),
                    new IlocItem(3, 0, 0, 0, [new IlocExtent(exif + SyntheticImages.HeicExifItem.Length, SyntheticImages.HeicXmpItem.Length)]));
            },
            null,
            StandardMdat);

        Strip(ImageKind.Heic, input).ShouldBe(Wiped(input));
    }

    [Theory]
    [InlineData(2, "application/rdf+xml")]
    [InlineData(2, "APPLICATION/RDF+XML")]
    [InlineData(3, "application/rdf+xml")]
    public void AHeicXmpItemIsFoundByItsContentTypeInEveryItemInfoVersion(int version, string contentType)
    {
        var input = SyntheticImages.HeicWithLocations(
            SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1", version: version), SyntheticImages.Infe(2, "Exif", version: version), SyntheticImages.Infe(3, "mime", contentType, version)),
            offsets => SyntheticImages.Iloc(1, 4, 4, 0, Items(offsets)),
            null,
            StandardMdat);

        Strip(ImageKind.Heic, input).ShouldBe(Wiped(input));
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    public void AHeicXmpItemInAnOldItemInfoEntryIsFoundByItsContentTypeAndTheUntypedExifIsLeftAlone(int version)
    {
        var input = SyntheticImages.HeicWithLocations(
            SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1", version: version), SyntheticImages.Infe(2, "Exif", version: version), SyntheticImages.Infe(3, "mime", "application/rdf+xml", version)),
            offsets => SyntheticImages.Iloc(1, 4, 4, 0, Items(offsets)),
            null,
            StandardMdat);

        var output = Strip(ImageKind.Heic, input);

        output.AsSpan().IndexOf(SyntheticImages.HeicXmpItem).ShouldBe(-1);
        output.AsSpan().IndexOf(SyntheticImages.HeicExifItem).ShouldBeGreaterThan(0);
    }

    [Fact]
    public void AHeicMimeItemOfAnotherContentTypeIsNotTouched()
    {
        var input = SyntheticImages.HeicWithLocations(
            SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1"), SyntheticImages.Infe(2, "mime", "text/plain"), SyntheticImages.Infe(3, "mime")),
            offsets => SyntheticImages.Iloc(1, 4, 4, 0, Items(offsets)),
            null,
            StandardMdat);

        Strip(ImageKind.Heic, input).ShouldBe(input);
    }

    [Fact]
    public void AHeicWithMetadataItemsButNoLocationBoxHasNothingToWipe()
    {
        var input = SyntheticImages.Heic(4032, 3024, 1, exifOrientation: 6);

        Strip(ImageKind.Heic, input).ShouldBe(input);
        Strip(ImageKind.Heic, SyntheticImages.Heic(4032, 3024)).ShouldBe(SyntheticImages.Heic(4032, 3024));
    }

    [Fact]
    public void AHeicMetadataItemWithNoLengthIsLeftAsItIs()
    {
        var input = SyntheticImages.HeicWithLocations(
            StandardIinf,
            offsets => SyntheticImages.Iloc(1, 4, 4, 0, Image(offsets), new IlocItem(2, 0, 0, 0, []), new IlocItem(3, 0, 0, 0, [new IlocExtent(offsets.Mdat, 0)])),
            null,
            StandardMdat);

        Strip(ImageKind.Heic, input).ShouldBe(input);
    }

    [Theory]
    [MemberData(nameof(RefusedHeicNames))]
    public void AHeicWhoseMetadataCannotBeLocatedSafelyIsRefused(string name)
    {
        var result = ImageMetadataStripper.Strip(ImageKind.Heic, RefusedHeic(name), "iphone.heic");

        result.IsFailure.ShouldBeTrue(name);
        result.Error.Code.ShouldBe(ImageErrors.TypeCode, name);
    }

    public static TheoryData<string> RefusedHeicNames() =>
    [
        "item-offset-method",
        "overlaps-the-image",
        "outside-the-file",
        "before-the-data",
        "external-data",
        "no-length-field",
        "idat-missing",
        "idat-too-short",
        "iloc-version-three",
        "odd-offset-size",
        "iloc-cut-short",
        "iloc-too-many-items",
        "iloc-twice",
        "huge-offset",
        "too-many-extents",
        "infe-without-name-end",
        "infe-version-four",
        "iinf-with-junk",
        "iinf-twice",
        "meta-cut-short",
    ];

    [Fact]
    public void EveryFixtureIsIdempotent()
    {
        (ImageKind Kind, byte[] File)[] fixtures =
        [
            (ImageKind.Jpeg, SyntheticImages.JpegWithMetadata(640, 480, 6)),
            (ImageKind.Jpeg, SyntheticImages.JpegWithMetadata(640, 480, 1)),
            (ImageKind.Jpeg, SyntheticImages.Jpeg(640, 480, 8, withExif: true)),
            (ImageKind.Png, SyntheticImages.PngWithMetadata(800, 600)),
            (ImageKind.WebP, SyntheticImages.WebPWithMetadata(4000, 3000)),
            (ImageKind.WebP, SyntheticImages.WebP(WebPKind.Lossless, 300, 200)),
            (ImageKind.Heic, SyntheticImages.HeicWithMetadata(4032, 3024)),
            (ImageKind.Heic, SyntheticImages.HeicWithMetadata(4032, 3024, useIdat: true)),
            (ImageKind.Heic, SyntheticImages.Heic(4032, 3024, 1, exifOrientation: 6)),
        ];

        foreach (var (kind, file) in fixtures)
        {
            var once = Strip(kind, file);
            Strip(kind, once).ShouldBe(once, kind.ToString());
        }
    }

    [Fact]
    public void AJpegWithoutApp0GetsTheOrientationBlockRightAfterSoi()
    {
        var output = Strip(ImageKind.Jpeg, SyntheticImages.Jpeg(640, 480, orientation: 6));

        Markers(output).ShouldBe([0xE1, 0xDB, 0xC0, 0xDA]);
        Segment(output, 0xE1).ShouldBe(MinimalExif(6));
    }

    [Fact]
    public void AJpegWhoseExifComesAfterATableGetsTheOrientationBlockBeforeThatTable()
    {
        var input = JpegOf(Table(), SyntheticImages.JpegSegment(0xE1, MinimalExif(3)), Frame(), Scan(), EndOfImage);

        var output = Strip(ImageKind.Jpeg, input);

        Markers(output).ShouldBe([0xE1, 0xDB, 0xC0, 0xDA]);
        ImageSniffer.Inspect(output).ShouldNotBeNull().Orientation.ShouldBe(3);
    }

    [Fact]
    public void AnExifBlockAfterTheFrameHeaderIsDroppedAndTheOrientationStaysOne()
    {
        var input = JpegOf(Table(), Frame(), SyntheticImages.JpegSegment(0xE1, MinimalExif(6)), Scan(), EndOfImage);

        var output = Strip(ImageKind.Jpeg, input);

        Markers(output).ShouldBe([0xDB, 0xC0, 0xDA]);
        ImageSniffer.Inspect(output).ShouldBe(ImageSniffer.Inspect(input));
    }

    [Fact]
    public void AJpegWithTwoScansKeepsBothAndDropsACommentBetweenThem()
    {
        var input = JpegOf(Table(), SyntheticImages.JpegSegment(0xC2, Frame()[4..]), Scan(), SyntheticImages.JpegSegment(0xFE, [0x41]), SyntheticImages.JpegSegment(0xC4, new byte[17]), Scan(), EndOfImage);
        var expected = JpegOf(Table(), SyntheticImages.JpegSegment(0xC2, Frame()[4..]), Scan(), SyntheticImages.JpegSegment(0xC4, new byte[17]), Scan(), EndOfImage);

        Strip(ImageKind.Jpeg, input).ShouldBe(expected);
    }

    [Fact]
    public void FillBytesBeforeAMarkerAreDroppedAndTheScanIsKeptAsItIs()
    {
        var input = JpegOf([0xFF, 0xFF], Table(), Frame(), Scan(), [0xFF, 0xFF], EndOfImage);

        Strip(ImageKind.Jpeg, input).ShouldBe(JpegOf(Table(), Frame(), Scan(), EndOfImage));
    }

    [Fact]
    public void DamagedJpegsAreRefused()
    {
        byte[][] damaged =
        [
            [0xFF, 0xD8, 0x00, 0x00],
            JpegOf([0x00], Table(), Frame(), Scan(), EndOfImage),
            JpegOf([0xFF, 0xD0], Table(), Frame(), Scan(), EndOfImage),
            JpegOf(Table(), Frame(), Scan()),
            JpegOf(Table(), Frame(), SyntheticImages.JpegSegment(0xDA, [0x01]), [0x12, 0x34, 0xFF]),
            JpegOf(Table(), Frame(), Scan(), [0xFF]),
            JpegOf([0xFF, 0xE1, 0x00, 0x01], Table(), Frame(), Scan(), EndOfImage),
            JpegOf([0xFF, 0xE1, 0x01, 0x00, 0x00], Table(), Frame(), Scan(), EndOfImage),
            JpegOf(Table(), Frame(), Scan(), EndOfImage)[..5],
            JpegOf([.. Enumerable.Range(0, 4100).SelectMany(_ => SyntheticImages.JpegSegment(0xFE, [0x41]))], Table(), Frame(), Scan(), EndOfImage),
            JpegOf(Table(), Scan(), EndOfImage),
        ];

        foreach (var file in damaged)
        {
            ImageMetadataStripper.Strip(ImageKind.Jpeg, file).IsFailure.ShouldBeTrue(Convert.ToHexString(file[..Math.Min(file.Length, 12)]));
        }
    }

    [Fact]
    public void AFileOfTheWrongKindOrAnUnknownKindIsRefused()
    {
        ImageMetadataStripper.Strip(ImageKind.Jpeg, SyntheticImages.Png(8, 8)).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.WebP, SyntheticImages.Png(8, 8)).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.Heic, SyntheticImages.Jpeg(8, 8)).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.Png, [0x89, 0x50]).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.WebP, [.. "RIFF"u8, 0, 0, 0, 0, .. "WAVE"u8]).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip(ImageKind.Jpeg, []).IsFailure.ShouldBeTrue();
        ImageMetadataStripper.Strip((ImageKind)99, SyntheticImages.Jpeg(8, 8)).IsFailure.ShouldBeTrue();
    }

    [Fact]
    public void ADamagedHeicBoxStructureIsRefused()
    {
        var plain = SyntheticImages.HeicWithMetadata(4032, 3024);
        byte[] ftyp = SyntheticImages.Ftyp("heic", "mif1");
        byte[][] damaged =
        [
            [.. SyntheticImages.Box("free", [0x00]), .. plain],
            [.. ftyp, .. SyntheticImages.Box("free", [0x00])],
            [.. ftyp, .. SyntheticImages.Box("meta", [0x00])],
            [.. ftyp, .. SyntheticImages.FullBox("meta", 0, 0, SyntheticImages.Iinf(SyntheticImages.Infe(2, "Exif")), SyntheticImages.Box("idat", [0x00]), SyntheticImages.Box("idat", [0x00]))],
            [.. ftyp, .. SyntheticImages.FullBox("meta", 0, 0, SyntheticImages.Box("free", [0x00]), [0x01, 0x02])],
            [.. ftyp, .. SyntheticImages.FullBox("meta", 0, 0, SyntheticImages.Box("iinf", [0x00, 0x00]))],
            [.. ftyp, .. SyntheticImages.FullBox("meta", 0, 0, SyntheticImages.Iinf(SyntheticImages.Box("infe", [0x02, 0x00, 0x00, 0x00])))],
            [.. ftyp, .. SyntheticImages.FullBox("meta", 0, 0, SyntheticImages.Iinf(SyntheticImages.Infe(2, "Exif")), SyntheticImages.Box("iloc", [0x00, 0x00, 0x00, 0x00, 0x44]))],
        ];

        foreach (var file in damaged)
        {
            ImageMetadataStripper.Strip(ImageKind.Heic, file).IsFailure.ShouldBeTrue(Convert.ToHexString(file[..Math.Min(file.Length, 40)]));
        }
    }

    [Fact]
    public void EveryCutOfEveryFixtureIsStrippedOrRefusedWithoutAnException()
    {
        foreach (var (kind, file) in Fixtures())
        {
            for (var length = 0; length <= file.Length; length++)
            {
                var cut = file.AsSpan(0, length).ToArray();

                var result = ImageMetadataStripper.Strip(kind, cut);

                if (result.IsSuccess)
                {
                    ImageSniffer.Inspect(result.Value).ShouldBe(ImageSniffer.Inspect(cut));
                }
            }
        }
    }

    [Fact]
    public void TwoThousandSeededDamagedFilesNeverThrowAndAnyAnswerReadsLikeTheFileDid()
    {
        var generator = new SeededBytes(0x5EED5);
        var fixtures = Fixtures();
        for (var round = 0; round < 2000; round++)
        {
            var (kind, original) = fixtures[round % fixtures.Count];
            var file = (byte[])original.Clone();
            for (var change = generator.Next(8) + 1; change > 0; change--)
            {
                file[generator.Next(file.Length)] = (byte)generator.Next(256);
            }

            var result = ImageMetadataStripper.Strip(kind, file);

            if (result.IsSuccess)
            {
                ImageSniffer.Inspect(result.Value).ShouldBe(ImageSniffer.Inspect(file));
            }
        }
    }

    private static List<(ImageKind Kind, byte[] File)> Fixtures() =>
    [
        (ImageKind.Jpeg, SyntheticImages.JpegWithMetadata(640, 480, 6)),
        (ImageKind.Png, SyntheticImages.PngWithMetadata(800, 600)),
        (ImageKind.WebP, SyntheticImages.WebPWithMetadata(4000, 3000)),
        (ImageKind.Heic, SyntheticImages.HeicWithMetadata(4032, 3024)),
        (ImageKind.Heic, SyntheticImages.HeicWithMetadata(4032, 3024, useIdat: true)),
    ];

    private static byte[] EndOfImage => [0xFF, 0xD9];

    private static byte[] Table() => SyntheticImages.JpegSegment(0xDB, [0x00, .. new byte[64]]);

    private static byte[] Frame() => SyntheticImages.JpegSegment(0xC0, [0x08, 0x01, 0xE0, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00]);

    private static byte[] Scan() => [.. SyntheticImages.JpegSegment(0xDA, [0x01, 0x01, 0x00, 0x00, 0x3F, 0x00]), .. SyntheticImages.ScanData];

    // SOI followed by the given pieces.
    private static byte[] JpegOf(params byte[][] pieces) => [0xFF, 0xD8, .. pieces.SelectMany(piece => piece)];

    // A small fixed-seed xorshift generator, so a failing input can be rebuilt exactly.
    private sealed class SeededBytes(uint seed)
    {
        private uint _state = seed;

        public int Next(int maxExclusive)
        {
            _state ^= _state << 13;
            _state ^= _state >> 17;
            _state ^= _state << 5;
            return (int)(_state % (uint)maxExclusive);
        }
    }

    private static byte[] StandardIinf { get; } = SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1"), SyntheticImages.Infe(2, "Exif"), SyntheticImages.Infe(3, "mime", "application/rdf+xml"));

    private static byte[] StandardMdat { get; } = [.. SyntheticImages.HeicImageData, .. SyntheticImages.HeicExifItem, .. SyntheticImages.HeicXmpItem];

    private static IlocItem Image(HeicOffsets offsets) => new(1, 0, 0, 0, [new IlocExtent(offsets.Mdat, SyntheticImages.HeicImageData.Length)]);

    // The three items of the standard mdat; offsets are counted from the base offset when there is one.
    private static IlocItem[] Items(HeicOffsets offsets, int baseOffsetSize = 0, int exifMethod = 0, int exifDataReference = 0, long? exifOffset = null, long? exifLength = null)
    {
        long baseOffset = baseOffsetSize > 0 ? offsets.Mdat : 0;
        var exifAt = offsets.Mdat + SyntheticImages.HeicImageData.Length;
        var xmpAt = exifAt + SyntheticImages.HeicExifItem.Length;
        return
        [
            new IlocItem(1, 0, 0, baseOffset, [new IlocExtent(offsets.Mdat - baseOffset, SyntheticImages.HeicImageData.Length)]),
            new IlocItem(2, exifMethod, exifDataReference, baseOffset, [new IlocExtent((exifOffset ?? exifAt) - baseOffset, exifLength ?? SyntheticImages.HeicExifItem.Length)]),
            new IlocItem(3, 0, 0, baseOffset, [new IlocExtent(xmpAt - baseOffset, SyntheticImages.HeicXmpItem.Length)]),
        ];
    }

    // The input with the Exif and XMP item payloads set to zero, found by their bytes.
    private static byte[] Wiped(byte[] input)
    {
        var wiped = (byte[])input.Clone();
        foreach (var item in new[] { SyntheticImages.HeicExifItem, SyntheticImages.HeicXmpItem })
        {
            var at = input.AsSpan().IndexOf(item);
            at.ShouldBeGreaterThan(0);
            wiped.AsSpan(at, item.Length).Clear();
        }

        return wiped;
    }

    private static byte[] RefusedHeic(string name)
    {
        byte[] Heic(Func<HeicOffsets, byte[]> iloc, byte[]? idat = null, byte[]? iinf = null) =>
            SyntheticImages.HeicWithLocations(iinf ?? StandardIinf, iloc, idat, StandardMdat);

        byte[] Standard(HeicOffsets offsets, int version = 1, int exifMethod = 0, int dataReference = 0, long? exifOffset = null, long? exifLength = null, int lengthSize = 4) =>
            SyntheticImages.Iloc(version, 4, lengthSize, 0, Items(offsets, 0, exifMethod, dataReference, exifOffset, exifLength));

        return name switch
        {
            "item-offset-method" => Heic(offsets => Standard(offsets, exifMethod: 2)),
            "overlaps-the-image" => Heic(offsets => Standard(offsets, exifOffset: offsets.Mdat)),
            "outside-the-file" => Heic(offsets => Standard(offsets, exifOffset: offsets.Mdat + 100_000)),
            "before-the-data" => Heic(offsets => Standard(offsets, exifOffset: 0)),
            "external-data" => Heic(offsets => Standard(offsets, dataReference: 1)),
            "no-length-field" => Heic(offsets => Standard(offsets, lengthSize: 0)),
            "idat-missing" => Heic(offsets => Standard(offsets, exifMethod: 1, exifOffset: 0)),
            "idat-too-short" => Heic(offsets => Standard(offsets, exifMethod: 1, exifOffset: 0), idat: new byte[4]),
            "iloc-version-three" => Heic(offsets => SyntheticImages.FullBox("iloc", 3, 0, [0x44, 0x00, 0x00, 0x00])),
            "odd-offset-size" => Heic(offsets => SyntheticImages.FullBox("iloc", 1, 0, [0x34, 0x00, 0x00, 0x00])),
            "iloc-cut-short" => Heic(offsets => SyntheticImages.FullBox("iloc", 1, 0, [0x44, 0x00, 0x00, 0x02])),
            "iloc-too-many-items" => Heic(offsets => SyntheticImages.FullBox("iloc", 2, 0, [0x44, 0x00, 0xFF, 0xFF, 0xFF, 0xFF])),
            "iloc-twice" => Heic(offsets => [.. Standard(offsets), .. Standard(offsets)]),
            "huge-offset" => Heic(offsets => SyntheticImages.Iloc(1, 8, 4, 0, Image(offsets), new IlocItem(2, 0, 0, 0, [new IlocExtent(-1, 4)]))),
            "too-many-extents" => Heic(offsets => SyntheticImages.Iloc(1, 4, 4, 0, new IlocItem(1, 0, 0, 0, [.. Enumerable.Repeat(new IlocExtent(offsets.Mdat, 0), 5000)]), new IlocItem(2, 0, 0, 0, [new IlocExtent(offsets.Mdat, 1)]))),
            "infe-without-name-end" => Heic(offsets => Standard(offsets), iinf: SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1"), SyntheticImages.FullBox("infe", 2, 0, [0x00, 0x02, 0x00, 0x00], "Exif"u8.ToArray()))),
            "infe-version-four" => Heic(offsets => Standard(offsets), iinf: SyntheticImages.Iinf(SyntheticImages.Infe(1, "hvc1"), SyntheticImages.Infe(2, "Exif", version: 4))),
            "iinf-with-junk" => Heic(offsets => Standard(offsets), iinf: SyntheticImages.FullBox("iinf", 0, 0, [0x00, 0x01], SyntheticImages.Infe(2, "Exif"), [0x01, 0x02, 0x03])),
            "iinf-twice" => Heic(offsets => Standard(offsets), iinf: [.. StandardIinf, .. StandardIinf]),
            "meta-cut-short" => SyntheticImages.Truncated(Heic(offsets => Standard(offsets)), 60),
            _ => throw new ArgumentOutOfRangeException(nameof(name), name, "Unknown case."),
        };
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
