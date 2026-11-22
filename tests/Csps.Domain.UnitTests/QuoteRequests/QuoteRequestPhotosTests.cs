using System.Security.Cryptography;
using Csps.Domain.QuoteRequests;

namespace Csps.Domain.UnitTests.QuoteRequests;

/// <summary>INQ-02, D-02, CWE-639: a request declares up to 5 photo places and keeps only the hash of its upload key.</summary>
public sealed class QuoteRequestPhotosTests
{
    private static readonly Guid RequestId = Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6");
    private static readonly DateTimeOffset Now = new(2026, 11, 22, 10, 30, 0, TimeSpan.Zero);
    private static readonly byte[] KeyHash = SHA256.HashData([1, 2, 3]);

    [Fact]
    public void EachNameBecomesOneEmptyPlaceInOrder()
    {
        var request = NewRequest();

        var result = request.DeclarePhotos(["logo.png", "C:\\fakepath\\sketch.jpg", "  back.webp  "], KeyHash, Now.AddHours(2));

        result.IsSuccess.ShouldBeTrue();
        request.Photos.Select(photo => photo.Slot).ShouldBe([0, 1, 2]);
        request.Photos.Select(photo => photo.FileName).ShouldBe(["logo.png", "sketch.jpg", "back.webp"]);
        request.Photos.ShouldAllBe(photo => photo.QuoteRequestId == RequestId && photo.PublicId == null && photo.StoredAtUtc == null);
        request.UploadKeyHash.ShouldBe(KeyHash);
        request.UploadKeyExpiresAtUtc.ShouldBe(Now.AddHours(2));
    }

    [Fact]
    public void FiveNamesAreTakenAndASixthIsRefused()
    {
        var five = Enumerable.Range(1, 5).Select(number => $"photo{number}.jpg").ToList();
        NewRequest().DeclarePhotos(five, KeyHash, Now).IsSuccess.ShouldBeTrue();

        var request = NewRequest();
        var result = request.DeclarePhotos([.. five, "photo6.jpg"], KeyHash, Now);

        Refused(result, "photos", "You can send up to 5 photos.");
        request.Photos.ShouldBeEmpty();
        request.UploadKeyHash.ShouldBeNull();
    }

    [Fact]
    public void ANameOfTwoHundredFiftyFiveCharactersIsTakenAndOneMoreIsRefused()
    {
        NewRequest().DeclarePhotos([new string('a', 255)], KeyHash, Now).IsSuccess.ShouldBeTrue();

        Refused(NewRequest().DeclarePhotos([new string('a', 256)], KeyHash, Now), "photos", "Keep each photo file name to 255 characters or fewer.");
    }

    [Fact]
    public void NoNamesAndASecondDeclarationAreRefused()
    {
        Refused(NewRequest().DeclarePhotos([], KeyHash, Now), "photos", QuoteRequestRules.PhotosInvalid);

        var request = NewRequest();
        request.DeclarePhotos(["a.jpg"], KeyHash, Now).IsSuccess.ShouldBeTrue();
        Refused(request.DeclarePhotos(["b.jpg"], KeyHash, Now), "photos", QuoteRequestRules.PhotosInvalid);
        request.Photos.ShouldHaveSingleItem().FileName.ShouldBe("a.jpg");
    }

    [Fact]
    public void AHashOfTheWrongSizeIsRefused()
    {
        var request = NewRequest();

        Refused(request.DeclarePhotos(["a.jpg"], new byte[31], Now), "uploadKey", QuoteRequestRules.UploadKeyInvalid);

        request.Photos.ShouldBeEmpty();
    }

    [Fact]
    public void MissingArgumentsThrow()
    {
        var request = NewRequest();
        Should.Throw<ArgumentNullException>(() => request.DeclarePhotos(null!, KeyHash, Now));
        Should.Throw<ArgumentNullException>(() => request.DeclarePhotos(["a.jpg"], null!, Now));
        Should.Throw<ArgumentNullException>(() => QuoteRequestRules.CleanPhotoName(null!, 0));
    }

    [Theory]
    [InlineData("logo.png", "logo.png")]
    [InlineData("/etc/passwd", "passwd")]
    [InlineData("a\\b\\c.jpg", "c.jpg")]
    [InlineData("ba\td.jpg\n", "bad.jpg")]
    [InlineData("   ", "Photo 3")]
    [InlineData("folder/", "Photo 3")]
    public void ANameIsCleanedOfFoldersAndControlCharacters(string name, string expected) =>
        QuoteRequestRules.CleanPhotoName(name, 2).ShouldBe(expected);

    [Fact]
    public void TheRejectOverloadsAgree()
    {
        var typed = QuoteRequestRules.Reject<int>("photos", "x");
        var plain = QuoteRequestRules.Reject("photos", "x");

        plain.Error.Code.ShouldBe(typed.Error.Code);
        plain.Error.FieldErrors.ShouldNotBeNull()["photos"].ShouldBe(typed.Error.FieldErrors.ShouldNotBeNull()["photos"]);
    }

    private static QuoteRequest NewRequest() =>
        QuoteRequest.Receive(RequestId, new QuoteRequestInput("Juan Dela Cruz", null, "0917 123 4567", null, null, null, null, null, null), Now).Value;

    private static void Refused(Csps.Domain.Common.Result result, string field, string message)
    {
        result.IsFailure.ShouldBeTrue();
        var fields = result.Error.FieldErrors.ShouldNotBeNull();
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}
