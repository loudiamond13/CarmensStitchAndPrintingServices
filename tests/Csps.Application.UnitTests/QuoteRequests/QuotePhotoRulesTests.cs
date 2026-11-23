using System.Buffers.Text;
using System.Security.Cryptography;
using Csps.Application.Common;
using Csps.Application.Images;
using Csps.Application.QuoteRequests;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.QuoteRequests;

/// <summary>INQ-02, D-02, CWE-639: the photo part of the quote form, the upload key, the settings and the quotes folder.</summary>
public sealed class QuotePhotoRulesTests
{
    private static readonly CreateQuoteRequestRequestValidator Validator = new();

    [Fact]
    public void FivePhotosWithAKeyHaveNoErrors() => Fields(Valid(Names(5), NewKey())).ShouldBeEmpty();

    [Fact]
    public void ASixthPhotoIsRefusedOnThePhotosField() =>
        One(Valid(Names(6), NewKey()), "photos", "You can send up to 5 photos.");

    [Fact]
    public void ANameIsLimitedToTwoHundredFiftyFiveCharacters()
    {
        Fields(Valid([new string('a', 255)], NewKey())).ShouldBeEmpty();
        One(Valid([new string('a', 256)], NewKey()), "photos", "Keep each photo file name to 255 characters or fewer.");
    }

    [Fact]
    public void ANullNameIsRefused() => One(Valid([null!], NewKey()), "photos", "Photos could not be attached. Try sending them again.");

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not a key")]
    public void PhotosWithoutAUsableKeyAreRefusedOnTheKeyField(string? key) =>
        One(Valid(Names(1), key), "uploadKey", "Photos could not be attached. Try sending them again.");

    [Fact]
    public void AKeyOfThirtyOneOrThirtyThreeBytesIsRefused()
    {
        One(Valid(Names(1), Base64Url.EncodeToString(new byte[31])), "uploadKey", QuoteRequestRulesText());
        One(Valid(Names(1), Base64Url.EncodeToString(new byte[33])), "uploadKey", QuoteRequestRulesText());
        One(Valid(Names(1), Base64Url.EncodeToString(new byte[200])), "uploadKey", QuoteRequestRulesText());
    }

    [Fact]
    public void NoPhotosNeedNoKey()
    {
        Fields(Valid(null, null)).ShouldBeEmpty();
        Fields(Valid([], null)).ShouldBeEmpty();
        Fields(Valid(null, "anything")).ShouldBeEmpty();
    }

    [Fact]
    public void AKeyIsHashedWithSha256()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);

        QuoteUploadKey.TryHash(Base64Url.EncodeToString(bytes), out var hash).ShouldBeTrue();

        hash.ShouldBe(SHA256.HashData(bytes));
    }

    [Fact]
    public void ABadKeyGivesNoHash()
    {
        QuoteUploadKey.TryHash(null, out var hash).ShouldBeFalse();
        hash.ShouldBeEmpty();
        QuoteUploadKey.TryHash("***", out _).ShouldBeFalse();
    }

    [Fact]
    public void TheKeyLifetimeIsTwoHoursAndHeldBetweenFiveMinutesAndTwentyFourHours()
    {
        var settings = new QuoteRequestSettings();
        settings.UploadKeyLifetime.ShouldBe(TimeSpan.FromHours(2));
        settings.Validate().ShouldBeNull();

        settings.UploadKeyLifetime = TimeSpan.FromMinutes(5);
        settings.Validate().ShouldBeNull();
        settings.UploadKeyLifetime = TimeSpan.FromHours(24);
        settings.Validate().ShouldBeNull();
        settings.UploadKeyLifetime = TimeSpan.FromMinutes(5) - TimeSpan.FromTicks(1);
        settings.Validate().ShouldNotBeNull().ShouldContain("UploadKeyLifetime");
        settings.UploadKeyLifetime = TimeSpan.FromHours(24) + TimeSpan.FromTicks(1);
        settings.Validate().ShouldNotBeNull().ShouldContain("UploadKeyLifetime");
    }

    [Fact]
    public void QuotePhotosLiveUnderTheQuotesFolder()
    {
        var id = Guid.Parse("7c4a9e12-3b60-4d85-a1f7-e92d0c58b436");

        PublicIds.QuoteFolder("csps", id).ShouldBe("csps/quotes/7c4a9e12-3b60-4d85-a1f7-e92d0c58b436");
        var first = PublicIds.NewQuote("csps", id);
        var second = PublicIds.NewQuote("csps", id);
        first.ShouldStartWith("csps/quotes/7c4a9e12-3b60-4d85-a1f7-e92d0c58b436/");
        first[(first.LastIndexOf('/') + 1)..].Length.ShouldBe(26);
        second.ShouldNotBe(first);
        Should.Throw<ArgumentException>(() => PublicIds.QuoteFolder(" ", id));
    }

    private static string QuoteRequestRulesText() => "Photos could not be attached. Try sending them again.";

    private static string[] Names(int count) => [.. Enumerable.Range(1, count).Select(number => $"photo{number}.jpg")];

    private static string NewKey() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    private static CreateQuoteRequestRequest Valid(IReadOnlyList<string>? photos, string? key) =>
        CreateQuoteRequestRequest.Empty with { CustomerName = "Juan Dela Cruz", ContactNumber = "0917 123 4567", Photos = photos, UploadKey = key };

    private static Dictionary<string, string[]> Fields(CreateQuoteRequestRequest request)
    {
        ValidationResult result = Validator.Validate(request);
        return result.IsValid
            ? []
            : ValidationResults.ToError(result, "quote-requests.validation", "Check the highlighted fields.").FieldErrors.ShouldNotBeNull()
                .ToDictionary(pair => pair.Key, pair => pair.Value);
    }

    private static void One(CreateQuoteRequestRequest request, string field, string message)
    {
        var fields = Fields(request);
        fields.Keys.ShouldBe([field]);
        fields[field].ShouldBe([message]);
    }
}
