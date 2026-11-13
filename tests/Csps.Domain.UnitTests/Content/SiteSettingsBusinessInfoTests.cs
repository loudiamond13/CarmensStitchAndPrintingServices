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
        settings.DirectionsUrl.ShouldBe("https://maps.app.goo.gl/abc123");
        settings.MapEmbedUrl.ShouldBe("https://www.google.com/maps/embed?pb=sample");
        settings.MessengerUrl.ShouldBe("https://m.me/cspsdemo");
        settings.FacebookUrl.ShouldBe("https://www.facebook.com/cspsdemo");
        settings.InstagramUrl.ShouldBe("https://www.instagram.com/cspsdemo");
        settings.TikTokUrl.ShouldBe("https://www.tiktok.com/@cspsdemo");
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

        var atLimit = settings.UpdateBusinessInfo(With(field, AtLimit(field, max)), Now);
        var over = settings.UpdateBusinessInfo(With(field, new string('x', max + 1)), Now);

        atLimit.IsSuccess.ShouldBeTrue(field);
        over.IsFailure.ShouldBeTrue(field);
        over.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message], field);
    }

    [Theory]
    [InlineData("directionsUrl", "javascript:alert(1)", "Paste a Google Maps link, like https://maps.app.goo.gl/abc123.")]
    [InlineData("directionsUrl", "http://maps.app.goo.gl/abc123", "Paste a Google Maps link, like https://maps.app.goo.gl/abc123.")]
    [InlineData("directionsUrl", "https://evil.example.test/maps", "Paste a Google Maps link, like https://maps.app.goo.gl/abc123.")]
    [InlineData("mapEmbedUrl", "https://evil.example.test/embed", "Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.")]
    [InlineData("mapEmbedUrl", "<iframe src=\"https://www.google.com/maps/embed?pb=1\"></iframe>", "Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.")]
    [InlineData("messengerUrl", "https://facebook.com/yourpage", "Paste your Messenger link, like https://m.me/yourpage.")]
    [InlineData("facebookUrl", "https://facebook.example.test/cspsdemo", "Paste your Facebook page link, like https://www.facebook.com/yourpage.")]
    [InlineData("facebookUrl", "https://user:secret@www.facebook.com/cspsdemo", "Paste your Facebook page link, like https://www.facebook.com/yourpage.")]
    [InlineData("instagramUrl", "https://www.instagram.com.evil.example.test/cspsdemo", "Paste your Instagram link, like https://www.instagram.com/yourpage.")]
    [InlineData("instagramUrl", "https://www.instagram.com/[yourpage]", "Paste your Instagram link, like https://www.instagram.com/yourpage.")]
    [InlineData("tiktokUrl", "https://tiktok.example.test/@cspsdemo", "Paste your TikTok link, like https://www.tiktok.com/@yourpage.")]
    [InlineData("tiktokUrl", "www.tiktok.com/@cspsdemo", "Paste your TikTok link, like https://www.tiktok.com/@yourpage.")]
    public void ALinkOutsideItsAllowListIsRefusedWithTheValidatorsWords(string field, string link, string message)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(With(field, link), Now);

        result.IsFailure.ShouldBeTrue(field);
        result.Error.FieldErrors.ShouldNotBeNull()[field].ShouldBe([message], field);
        settings.UpdatedAtUtc.ShouldBeNull();
    }

    [Theory]
    [InlineData("860")]
    [InlineData("86a0")]
    [InlineData("8 60")]
    [InlineData("٨٦٠٠")]
    public void APostalCodeThatIsNotFourDigitsIsRefusedWithTheValidatorsWords(string code)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { PostalCode = code }, Now);

        result.Error.FieldErrors.ShouldNotBeNull()["postalCode"].ShouldBe(["Use the 4-digit postal code, like 8600."]);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("a@b@c.test")]
    [InlineData("@example.test")]
    [InlineData("name@")]
    [InlineData("[hello@yourdomain.ph]")]
    public void AContactEmailOfTheWrongShapeIsRefusedWithTheValidatorsWords(string email)
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { ContactEmail = email }, Now);

        result.Error.FieldErrors.ShouldNotBeNull()["contactEmail"].ShouldBe(["Enter a valid email, like name@gmail.com"]);
    }

    [Fact]
    public void EveryBrokenLinkIsReportedTogetherAndNothingIsChanged()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);
        var values = Valid() with
        {
            BusinessName = "Changed",
            DirectionsUrl = "https://evil.example.test/maps",
            MapEmbedUrl = "https://evil.example.test/embed",
            MessengerUrl = "https://evil.example.test/page",
            FacebookUrl = "https://evil.example.test/page",
            InstagramUrl = "https://evil.example.test/page",
            TikTokUrl = "https://evil.example.test/page",
            PostalCode = "12",
            ContactEmail = "nope",
        };

        var result = settings.UpdateBusinessInfo(values, Now);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(
            ["directionsUrl", "mapEmbedUrl", "messengerUrl", "facebookUrl", "instagramUrl", "tiktokUrl", "postalCode", "contactEmail"],
            ignoreOrder: true);
        settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
        settings.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void ALinkWithPaddingIsCheckedAfterTrimmingAndStoredTrimmed()
    {
        var settings = SiteSettings.CreateDefault(CreatedAt);

        var result = settings.UpdateBusinessInfo(Valid() with { FacebookUrl = "  https://www.facebook.com/cspsdemo  ", ContactEmail = " shop@example.test " }, Now);

        result.IsSuccess.ShouldBeTrue();
        settings.FacebookUrl.ShouldBe("https://www.facebook.com/cspsdemo");
        settings.ContactEmail.ShouldBe("shop@example.test");
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
        "https://maps.app.goo.gl/abc123",
        "https://www.google.com/maps/embed?pb=sample",
        "https://m.me/cspsdemo",
        "https://www.facebook.com/cspsdemo",
        "https://www.instagram.com/cspsdemo",
        "https://www.tiktok.com/@cspsdemo",
        "shop@example.test",
        [Globe]);

    // The longest value of the field that still passes its shape rule.
    private static string AtLimit(string field, int max) => field switch
    {
        "postalCode" => new string('1', max),
        "directionsUrl" => Pad("https://maps.app.goo.gl/", max),
        "mapEmbedUrl" => Pad("https://www.google.com/maps/embed?", max),
        "messengerUrl" => Pad("https://m.me/", Math.Min(max, "https://m.me/".Length + 100)),
        "facebookUrl" => Pad("https://www.facebook.com/", max),
        "instagramUrl" => Pad("https://www.instagram.com/", max),
        "tiktokUrl" => Pad("https://www.tiktok.com/@", max),
        "contactEmail" => new string('x', max - "@example.test".Length) + "@example.test",
        _ => new string('x', max),
    };

    private static string Pad(string prefix, int length) => prefix + new string('x', length - prefix.Length);

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
