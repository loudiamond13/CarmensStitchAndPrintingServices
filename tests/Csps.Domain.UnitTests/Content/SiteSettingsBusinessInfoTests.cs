using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

public sealed class SiteSettingsBusinessInfoTests
{
    private static readonly DateTimeOffset CreatedAt = new(2026, 10, 7, 1, 2, 3, TimeSpan.Zero);
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 9, 30, 0, TimeSpan.Zero);

    private static readonly BusinessPhone Globe = new("0917 123 4567", "Globe", IsMain: true);
    private static readonly BusinessPhone Landline = new("02 8123 4567", null, IsMain: false);

    [Fact]
    public void TheValuesAreStoredTrimmedAndTheChangedFieldsAreNamedInFormOrder()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        var values = Valid() with
        {
            BusinessName = "  Sample Shop  ",
            Tagline = " A sample tagline. ",
            AboutText = " About the sample shop. ",
            Street = " 12 Sample St., Poblacion ",
            Phones = [Globe, Landline],
        };

        var changes = settings.UpdateBusinessInfo(values, Now).Value;

        settings.BusinessName.ShouldBe("Sample Shop");
        settings.Tagline.ShouldBe("A sample tagline.");
        settings.AboutText.ShouldBe("About the sample shop.");
        settings.TurnaroundLine.ShouldBe("Mockups in 24 hours.");
        settings.Street.ShouldBe("12 Sample St., Poblacion");
        settings.TownOrCity.ShouldBe("Sample City");
        settings.Province.ShouldBe("Sample Province");
        settings.PostalCode.ShouldBe("1000");
        settings.DirectionsUrl.ShouldBe("https://maps.example.test/directions");
        settings.MapEmbedUrl.ShouldBe("https://maps.example.test/embed");
        settings.MessengerUrl.ShouldBe("https://m.me/cspsdemo");
        settings.FacebookUrl.ShouldBe("https://facebook.example.test/cspsdemo");
        settings.InstagramUrl.ShouldBe("https://instagram.example.test/cspsdemo");
        settings.TikTokUrl.ShouldBe("https://tiktok.example.test/@cspsdemo");
        settings.ContactEmail.ShouldBe("shop@example.test");
        changes.ChangedFields.ShouldBe(
        [
            "businessName", "tagline", "aboutText", "turnaroundLine", "street", "townOrCity", "province", "postalCode",
            "directionsUrl", "mapEmbedUrl", "messengerUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "contactEmail",
        ]);
        settings.UpdatedAtUtc.ShouldBe(Now);
        settings.CreatedAtUtc.ShouldBe(CreatedAt);
    }

    [Fact]
    public void AnEmptyOptionalValueBecomesNullAndTheTwoRequiredColumnsBecomeAnEmptyString()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        settings.UpdateBusinessInfo(Valid(), Now).IsSuccess.ShouldBeTrue();
        var cleared = Valid() with
        {
            AboutText = "   ",
            TurnaroundLine = "",
            Street = null,
            TownOrCity = " ",
            Province = "",
            PostalCode = "",
            DirectionsUrl = "",
            MapEmbedUrl = "",
            MessengerUrl = "",
            FacebookUrl = "  ",
            InstagramUrl = "",
            TikTokUrl = null,
            ContactEmail = "",
        };

        var changes = settings.UpdateBusinessInfo(cleared, Now.AddMinutes(1)).Value;

        new[]
        {
            settings.AboutText, settings.TurnaroundLine, settings.Street, settings.TownOrCity, settings.Province, settings.PostalCode,
            settings.DirectionsUrl, settings.MapEmbedUrl, settings.MessengerUrl, settings.InstagramUrl, settings.TikTokUrl,
        }.ShouldAllBe(value => value == null);
        settings.FacebookUrl.ShouldBeEmpty();
        settings.ContactEmail.ShouldBeEmpty();
        changes.ChangedFields.Count.ShouldBe(13);
    }

    [Fact]
    public void SavingTheSameValuesAgainChangesNothingAndLeavesTheStampAlone()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        settings.UpdateBusinessInfo(Valid(), Now).IsSuccess.ShouldBeTrue();

        var again = settings.UpdateBusinessInfo(Valid(), Now.AddHours(1)).Value;

        again.ChangedFields.ShouldBeEmpty();
        settings.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public void OnlyTheFieldsThatDifferAreNamed()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        settings.UpdateBusinessInfo(Valid(), Now).IsSuccess.ShouldBeTrue();

        var changes = settings.UpdateBusinessInfo(Valid() with { Tagline = "A new line.", InstagramUrl = null }, Now.AddHours(1)).Value;

        changes.ChangedFields.ShouldBe(["tagline", "instagramUrl"]);
        settings.UpdatedAtUtc.ShouldBe(Now.AddHours(1));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankBusinessNameAndTaglineAreRefused(string blank)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { BusinessName = blank, Tagline = blank }, Now);

        var errors = result.Error.FieldErrors.ShouldNotBeNull();
        errors["businessName"].ShouldBe(["Enter the business name."]);
        errors["tagline"].ShouldBe(["Enter a tagline."]);
        result.Error.Code.ShouldBe("site-settings.invalid-request");
        result.Error.Message.ShouldBe("Check the highlighted fields.");
    }

    [Theory]
    [InlineData("businessName", 120, "Keep this to 120 characters or fewer.")]
    [InlineData("tagline", 160, "Keep the tagline to 160 characters or fewer.")]
    [InlineData("aboutText", 600, "Keep this to 600 characters or fewer.")]
    [InlineData("turnaroundLine", 120, "Keep the turnaround line to 120 characters or fewer.")]
    [InlineData("street", 120, "Keep this to 120 characters or fewer.")]
    [InlineData("townOrCity", 60, "Keep this to 60 characters or fewer.")]
    [InlineData("province", 60, "Keep this to 60 characters or fewer.")]
    [InlineData("postalCode", 4, "Keep this to 4 characters or fewer.")]
    [InlineData("directionsUrl", 300, "Keep this to 300 characters or fewer.")]
    [InlineData("mapEmbedUrl", 1000, "Keep this to 1000 characters or fewer.")]
    [InlineData("messengerUrl", 120, "Keep this to 120 characters or fewer.")]
    [InlineData("facebookUrl", 300, "Keep this to 300 characters or fewer.")]
    [InlineData("instagramUrl", 300, "Keep this to 300 characters or fewer.")]
    [InlineData("tiktokUrl", 300, "Keep this to 300 characters or fewer.")]
    [InlineData("contactEmail", 254, "Keep this to 254 characters or fewer.")]
    public void AValueOneOverItsLimitIsRefusedAndOneAtTheLimitFits(string field, int max, string message)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var atLimit = settings.UpdateBusinessInfo(With(field, new string('x', max)), Now);
        var over = settings.UpdateBusinessInfo(With(field, new string('x', max + 1)), Now);

        atLimit.IsSuccess.ShouldBeTrue(field);
        over.IsFailure.ShouldBeTrue(field);
        over.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message], field);
    }

    [Fact]
    public void TheLengthIsCountedAfterTrimming()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        settings.UpdateBusinessInfo(Valid() with { PostalCode = " 1000 " }, Now).IsSuccess.ShouldBeTrue();
    }

    [Fact]
    public void AFailureChangesNothing()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { Tagline = "", BusinessName = "Changed" }, Now);

        result.IsFailure.ShouldBeTrue();
        settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
        settings.Tagline.ShouldBe(SiteSettingsDefaults.Tagline);
        settings.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void ThePhoneRowsComeBackMainFirstWithPositionsInThatOrder()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var phones = settings.UpdateBusinessInfo(Valid() with { Phones = [Landline, Globe] }, Now).Value.Phones;

        phones.Select(phone => phone.Number).ShouldBe(["+639171234567", "+63281234567"]);
        phones.Select(phone => phone.IsMain).ShouldBe([true, false]);
        phones.Select(phone => phone.Position).ShouldBe([0, 1]);
        phones[0].Label.ShouldBe("Globe");
        phones.ShouldAllBe(phone => phone.CreatedAtUtc == Now);
    }

    [Fact]
    public void WithNoNumberFlaggedMainTheFirstOneIsTheMainNumber()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var phones = settings.UpdateBusinessInfo(Valid() with { Phones = [Landline, Globe with { IsMain = false }] }, Now).Value.Phones;

        phones.Select(phone => phone.Number).ShouldBe(["+63281234567", "+639171234567"]);
        phones.Select(phone => phone.IsMain).ShouldBe([true, false]);
    }

    [Fact]
    public void NoNumbersIsAllowedAndGivesAnEmptyList()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        settings.UpdateBusinessInfo(Valid() with { Phones = [] }, Now).Value.Phones.ShouldBeEmpty();
    }

    [Fact]
    public void FourNumbersFitAndFiveAreRefused()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        var four = Enumerable.Range(0, 4).Select(index => new BusinessPhone($"091712345{index:00}", null, index == 0)).ToList();
        var five = Enumerable.Range(0, 5).Select(index => new BusinessPhone($"091712345{index:00}", null, index == 0)).ToList();

        settings.UpdateBusinessInfo(Valid() with { Phones = four }, Now).Value.Phones.Count.ShouldBe(4);
        var tooMany = settings.UpdateBusinessInfo(Valid() with { Phones = five }, Now);

        tooMany.Error.FieldErrors.ShouldNotBeNull()["phones"].ShouldBe(["You can list up to 4 numbers."]);
    }

    [Fact]
    public void TwoMainNumbersAreRefused()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { Phones = [Globe, Landline with { IsMain = true }] }, Now);

        result.Error.FieldErrors.ShouldNotBeNull()["phones"].ShouldBe(["Choose the main number."]);
    }

    [Fact]
    public void ANumberListedTwiceIsRefusedOnTheSecondRowWhateverTheSpacing()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { Phones = [Globe, new BusinessPhone("+63 917 123 4567", null, false)] }, Now);

        result.Error.FieldErrors.ShouldNotBeNull()["phones[1].number"].ShouldBe(["This number is already listed."]);
    }

    [Fact]
    public void ABadNumberOrLabelIsReportedOnItsRow()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(
            Valid() with { Phones = [Globe, new BusinessPhone("[0917 000 0000]", new string('g', 21), false)] },
            Now);

        var errors = result.Error.FieldErrors.ShouldNotBeNull();
        errors["phones[1].number"].ShouldBe([PhilippinePhone.InvalidMessage]);
        errors["phones[1].label"].ShouldBe(["Keep the label to 20 characters or fewer."]);
    }

    [Fact]
    public void ATooManyListStillReportsTheRowsThatAreWrong()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        var rows = new List<BusinessPhone> { Globe, Landline, new("0918 123 4567", null, false), new("0919 123 4567", null, false), new("nope", null, false) };

        var result = settings.UpdateBusinessInfo(Valid() with { Phones = rows }, Now);

        var errors = result.Error.FieldErrors.ShouldNotBeNull();
        errors["phones"].ShouldBe(["You can list up to 4 numbers."]);
        errors["phones[4].number"].ShouldBe([PhilippinePhone.InvalidMessage]);
    }

    [Fact]
    public void ANullValuesObjectIsAProgrammingError()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        Should.Throw<ArgumentNullException>(() => settings.UpdateBusinessInfo(null!, Now));
    }

    private static BusinessInfo Valid() => new(
        "Sample Shop",
        "A sample tagline.",
        "About the sample shop.",
        "Mockups in 24 hours.",
        "12 Sample St., Poblacion",
        "Sample City",
        "Sample Province",
        "1000",
        "https://maps.example.test/directions",
        "https://maps.example.test/embed",
        "https://m.me/cspsdemo",
        "https://facebook.example.test/cspsdemo",
        "https://instagram.example.test/cspsdemo",
        "https://tiktok.example.test/@cspsdemo",
        "shop@example.test",
        [Globe]);

    private static BusinessInfo With(string field, string value) => field switch
    {
        "businessName" => Valid() with { BusinessName = value },
        "tagline" => Valid() with { Tagline = value },
        "aboutText" => Valid() with { AboutText = value },
        "turnaroundLine" => Valid() with { TurnaroundLine = value },
        "street" => Valid() with { Street = value },
        "townOrCity" => Valid() with { TownOrCity = value },
        "province" => Valid() with { Province = value },
        "postalCode" => Valid() with { PostalCode = value },
        "directionsUrl" => Valid() with { DirectionsUrl = value },
        "mapEmbedUrl" => Valid() with { MapEmbedUrl = value },
        "messengerUrl" => Valid() with { MessengerUrl = value },
        "facebookUrl" => Valid() with { FacebookUrl = value },
        "instagramUrl" => Valid() with { InstagramUrl = value },
        "tiktokUrl" => Valid() with { TikTokUrl = value },
        "contactEmail" => Valid() with { ContactEmail = value },
        _ => throw new ArgumentOutOfRangeException(nameof(field), field, "Unknown field."),
    };
}
