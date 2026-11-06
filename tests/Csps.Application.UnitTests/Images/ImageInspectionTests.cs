using Csps.Application.Images;
using Csps.Domain.Common;

namespace Csps.Application.UnitTests.Images;

/// <summary>IMG-02, D-34, T-09-05: the type, byte, pixel and side rules are exact at every boundary, on the upright size, and a damaged file fails as a result.</summary>
public sealed class ImageInspectionTests
{
    private static readonly ImageUploadSettings Defaults = new();

    [Fact]
    public void AFileOfExactlyMaxBytesIsAcceptedAndOneByteMoreIsRefusedWithTheTenMegabyteMessage()
    {
        var exact = Padded(Defaults.MaxBytes);
        var over = Padded(Defaults.MaxBytes + 1);

        ImageInspection.Check(exact, "team.jpg", Defaults).IsSuccess.ShouldBeTrue();
        var refused = ImageInspection.Check(over, "team.jpg", Defaults);

        refused.IsFailure.ShouldBeTrue();
        refused.Error.Code.ShouldBe("images.too-large");
        refused.Error.Message.ShouldBe("team.jpg is over 10 MB. Choose a smaller photo.");
        refused.Error.FieldErrors.ShouldNotBeNull()["file"].ShouldBe(["team.jpg is over 10 MB. Choose a smaller photo."]);
    }

    [Theory]
    [InlineData(5000, 5000, true)]
    [InlineData(5001, 5000, false)]
    [InlineData(5000, 5001, false)]
    [InlineData(10000, 2500, true)]
    [InlineData(2500, 10000, true)]
    [InlineData(10001, 100, false)]
    [InlineData(100, 10001, false)]
    [InlineData(10000, 10000, false)]
    public void ThePixelCountAndTheLongSideAreExactAtTheirLimits(int width, int height, bool accepted)
    {
        var result = ImageInspection.Check(Jpeg(width, height), "print.jpg", Defaults);

        result.IsSuccess.ShouldBe(accepted);
        if (!accepted)
        {
            result.Error.Code.ShouldBe("images.too-big");
            result.Error.Message.ShouldBe("print.jpg is too big. Photos can be at most 25 megapixels.");
        }
    }

    [Fact]
    public void ThePixelCountIsWorkedOutIn64BitArithmetic()
    {
        var settings = new ImageUploadSettings { MaxSide = 70_000 };

        var result = ImageInspection.Check(Jpeg(65_535, 65_535), "huge.jpg", settings);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("images.too-big");
    }

    [Theory]
    [InlineData(1, 400, 300)]
    [InlineData(4, 400, 300)]
    [InlineData(5, 300, 400)]
    [InlineData(6, 300, 400)]
    [InlineData(7, 300, 400)]
    [InlineData(8, 300, 400)]
    public void TheSizeIsTheUprightOneSoTheSidewaysOrientationsSwapWidthAndHeight(int orientation, int width, int height)
    {
        var facts = ImageInspection.Check(Jpeg(400, 300, orientation), "side.jpg", Defaults).Value;

        facts.UprightWidth.ShouldBe(width);
        facts.UprightHeight.ShouldBe(height);
    }

    [Fact]
    public void ALongSideIsJudgedOnTheUprightSize()
    {
        var settings = new ImageUploadSettings { MaxSide = 400 };

        ImageInspection.Check(Jpeg(400, 300, orientation: 6), "side.jpg", settings).IsSuccess.ShouldBeTrue();
        ImageInspection.Check(Jpeg(401, 300, orientation: 6), "side.jpg", settings).Error.Code.ShouldBe("images.too-big");
    }

    [Fact]
    public void ALowerConfiguredByteLimitIsShownInTheMessage()
    {
        var photo = Jpeg(640, 480);

        ImageInspection.Check(photo, "a.jpg", new ImageUploadSettings { MaxBytes = 50 }).Error.Message.ShouldBe("a.jpg is over 50 bytes. Choose a smaller photo.");
        ImageInspection.Check(Padded(3000), "a.jpg", new ImageUploadSettings { MaxBytes = 2048 }).Error.Message.ShouldBe("a.jpg is over 2 KB. Choose a smaller photo.");
        ImageInspection.Check(Padded(3_000_000), "a.jpg", new ImageUploadSettings { MaxBytes = 2_097_152 }).Error.Message.ShouldBe("a.jpg is over 2 MB. Choose a smaller photo.");
    }

    [Fact]
    public void ATruncatedJpegIsRefusedWithTheTypeMessageAndNeverThrows()
    {
        var whole = Jpeg(640, 480, orientation: 6);

        for (var length = 0; length < whole.Length - 14; length++)
        {
            var result = ImageInspection.Check(whole.AsMemory(0, length), "cut.jpg", Defaults);
            result.IsFailure.ShouldBeTrue($"length {length}");
            result.Error.Code.ShouldBe("images.type");
        }
    }

    [Fact]
    public void AJpegWithASelfLoopingSegmentLengthIsRefusedWithTheTypeMessageAndNeverHangs()
    {
        var zeroLength = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x00, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x01, 0xE0, 0x02, 0x80, 0x01, 0x01, 0x11, 0x00 };
        var oneLength = new byte[] { 0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x01, 0xFF, 0xE0, 0x00, 0x01 };

        ImageInspection.Check(zeroLength, "loop.jpg", Defaults).Error.Code.ShouldBe("images.type");
        ImageInspection.Check(oneLength, "loop.jpg", Defaults).Error.Code.ShouldBe("images.type");
    }

    [Fact]
    public void AJpegThatIsOnlyEmptySegmentsStopsAtTheSegmentCapAndIsRefused()
    {
        var empty = new List<byte> { 0xFF, 0xD8 };
        for (var segment = 0; segment < 600; segment++)
        {
            empty.AddRange([0xFF, 0xE0, 0x00, 0x02]);
        }

        empty.AddRange(Jpeg(640, 480).Skip(2));

        var result = ImageInspection.Check(empty.ToArray(), "empty.jpg", Defaults);

        result.IsFailure.ShouldBeTrue();
        result.Error.Code.ShouldBe("images.type");
    }

    [Fact]
    public void ASvgIsRefusedWithTheTypeMessage()
    {
        var result = ImageInspection.Check(Svg(), "logo.svg", Defaults);

        result.Error.Message.ShouldBe("logo.svg isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
    }

    [Fact]
    public void AFileNameWithControlCharactersAndFoldersIsCleanedAndCutTo80Characters()
    {
        var name = "C:\\folder\\\u0001\u0007" + new string('a', 60) + "\n" + new string('b', 60) + ".jpg";

        var message = ImageInspection.Check(Svg(), name, Defaults).Error.Message;

        var shown = new string('a', 60) + new string('b', 20);
        message.ShouldBe($"{shown} isn't a photo we can use. Choose a JPG, PNG, WEBP or HEIC file.");
        shown.Length.ShouldBe(80);
        message.Any(char.IsControl).ShouldBeFalse();
        message.ShouldNotContain("folder");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("\u0001\u0002")]
    public void ANameWithNothingLeftIsShownAsThisFile(string? name)
    {
        ImageInspection.Check(Svg(), name, Defaults).Error.Message.ShouldStartWith("This file isn't a photo");
    }

    [Fact]
    public void ANullSettingsObjectIsAProgrammingError() =>
        Should.Throw<ArgumentNullException>(() => ImageInspection.Check(Jpeg(1, 1), "a.jpg", null!));

    [Fact]
    public void TheErrorsAreValidationErrorsOnTheFileField()
    {
        Error tooLarge = ImageErrors.TooLarge("a.jpg", 1_048_576);
        Error tooBig = ImageErrors.TooBig("a.jpg");

        tooLarge.Kind.ShouldBe(ErrorKind.Validation);
        tooBig.Kind.ShouldBe(ErrorKind.Validation);
        tooLarge.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["file"]);
        tooBig.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["file"]);
    }

    private static byte[] Svg() => "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"></svg>"u8.ToArray();

    // SOI, an optional Exif segment holding the orientation, a quantization table, a baseline frame header, a tiny scan and EOI.
    private static byte[] Jpeg(int width, int height, int orientation = 1)
    {
        var file = new List<byte> { 0xFF, 0xD8 };
        if (orientation != 1)
        {
            byte[] exif = [.. "Exif\0\0"u8.ToArray(), 0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, (byte)orientation, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00];
            file.AddRange([0xFF, 0xE1, (byte)((exif.Length + 2) >> 8), (byte)(exif.Length + 2)]);
            file.AddRange(exif);
        }

        file.AddRange([0xFF, 0xDB, 0x00, 0x43, 0x00]);
        file.AddRange(new byte[64]);
        file.AddRange([0xFF, 0xC0, 0x00, 0x0B, 0x08, (byte)(height >> 8), (byte)height, (byte)(width >> 8), (byte)width, 0x01, 0x01, 0x11, 0x00]);
        file.AddRange([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x12, 0x34, 0xFF, 0xD9]);
        return [.. file];
    }

    // A valid small JPEG with zero bytes after the end marker, so the file is exactly the wanted length.
    private static byte[] Padded(int length)
    {
        var jpeg = Jpeg(640, 480);
        return length <= jpeg.Length ? jpeg : [.. jpeg, .. new byte[length - jpeg.Length]];
    }
}
