using Csps.Application.Common;
using Csps.Application.Content;

namespace Csps.Application.UnitTests.Content;

/// <summary>
/// CONT-01, OR-3, D-23, D-24, D-36: every Business Info rule refuses bad input on its own field with the UI-SPEC message. Lengths are
/// counted in UTF-16 code units, the same unit as a JavaScript string length. All values are fake.
/// </summary>
public sealed class UpdateSiteSettingsRequestValidatorTests
{
    private const string EmailMessage = "Enter a valid email, like name@gmail.com";
    private const string PhoneMessage = "Enter a phone number, like 0917 123 4567 or 02 8123 4567.";

    private static readonly UpdateSiteSettingsRequestValidator Validator = new();

    private static readonly UpdateSiteSettingsRequest Valid = new(
        Version: "AAAAAAAAB9E=",
        BusinessName: "Sample Shop",
        Tagline: "Sample tagline",
        AboutText: "About the sample shop.",
        TurnaroundLine: "Mockups in 24 hours.",
        Street: "12 Sample St., Poblacion",
        TownOrCity: "Sample City",
        Province: "Sample Province",
        PostalCode: "8600",
        DirectionsUrl: "https://maps.app.goo.gl/abc123",
        MapEmbedUrl: "https://www.google.com/maps/embed?pb=sample",
        MessengerUrl: "https://m.me/cspsdemo",
        FacebookUrl: "https://www.facebook.com/cspsdemo",
        InstagramUrl: "https://www.instagram.com/cspsdemo",
        TiktokUrl: "https://www.tiktok.com/@cspsdemo",
        ContactEmail: "shop-private@example.test",
        QuoteAlertsEmail: "alerts-private@example.test",
        Phones: [new PhoneEntry("0917 123 4567", "Globe", IsMain: true), new PhoneEntry("02 8123 4567", null, IsMain: false)]);

    [Fact]
    public void AFullValidFormPasses() => Fields(Valid).ShouldBeEmpty();

    [Fact]
    public void AFormWithOnlyTheRequiredValuesPasses() =>
        Fields(Valid with
        {
            AboutText = null,
            TurnaroundLine = "",
            PostalCode = " ",
            DirectionsUrl = null,
            MapEmbedUrl = "",
            MessengerUrl = null,
            FacebookUrl = null,
            InstagramUrl = null,
            TiktokUrl = null,
            ContactEmail = null,
            QuoteAlertsEmail = null,
            Phones = [new PhoneEntry("0917 123 4567", null, IsMain: true)],
        }).ShouldBeEmpty();

    [Fact]
    public void AnEmptyBodyReportsEveryRequiredFieldAtOnce()
    {
        var fields = Fields(UpdateSiteSettingsRequest.Empty);

        fields.Keys.ShouldBe(["version", "businessName", "tagline", "street", "townOrCity", "province", "phones"], ignoreOrder: true);
        fields["version"].ShouldBe(["Reload the form and try again."]);
        fields["businessName"].ShouldBe(["Enter the business name."]);
        fields["tagline"].ShouldBe(["Enter a tagline."]);
        fields["street"].ShouldBe(["Enter the street and barangay."]);
        fields["townOrCity"].ShouldBe(["Enter the town or city."]);
        fields["province"].ShouldBe(["Enter the province."]);
        fields["phones"].ShouldBe(["Add at least one phone number."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not base64!")]
    [InlineData("AAAA")]
    public void ABadVersionIsRefused(string? version) =>
        Fields(Valid with { Version = version })["version"].ShouldBe(["Reload the form and try again."]);

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankBusinessNameIsRefused(string? name) =>
        Fields(Valid with { BusinessName = name })["businessName"].ShouldBe(["Enter the business name."]);

    [Fact]
    public void ABusinessNameOverOneHundredCharactersIsRefusedAndExactlyOneHundredFits()
    {
        Fields(Valid with { BusinessName = new string('a', 100) }).ShouldBeEmpty();
        Fields(Valid with { BusinessName = new string('a', 101) })["businessName"].ShouldBe(["Keep the business name to 100 characters or fewer."]);
    }

    [Fact]
    public void TheNameLengthCountsUtf16UnitsSoAHundredWithAnNTildePassesAndAHundredAndOneFails()
    {
        var hundred = new string('a', 99) + "ñ";
        Fields(Valid with { BusinessName = hundred }).ShouldBeEmpty();
        Fields(Valid with { BusinessName = hundred + "a" })["businessName"].ShouldBe(["Keep the business name to 100 characters or fewer."]);
    }

    [Fact]
    public void TheNameLengthIsCountedAfterTrimming() =>
        Fields(Valid with { BusinessName = "  " + new string('a', 100) + "  " }).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankTaglineIsRefused(string? tagline) =>
        Fields(Valid with { Tagline = tagline })["tagline"].ShouldBe(["Enter a tagline."]);

    [Fact]
    public void ATaglineOver160CharactersIsRefusedAndExactly160Fits()
    {
        Fields(Valid with { Tagline = new string('a', 160) }).ShouldBeEmpty();
        Fields(Valid with { Tagline = new string('a', 161) })["tagline"].ShouldBe(["Keep the tagline to 160 characters or fewer."]);
    }

    [Fact]
    public void ATurnaroundLineOver120CharactersIsRefusedAndAnEmptyOneIsAllowed()
    {
        Fields(Valid with { TurnaroundLine = new string('a', 120) }).ShouldBeEmpty();
        Fields(Valid with { TurnaroundLine = new string('a', 121) })["turnaroundLine"].ShouldBe(["Keep the turnaround line to 120 characters or fewer."]);
        Fields(Valid with { TurnaroundLine = string.Empty }).ShouldBeEmpty();
    }

    [Fact]
    public void AnAboutTextOver600CharactersIsRefused()
    {
        Fields(Valid with { AboutText = new string('a', 600) }).ShouldBeEmpty();
        Fields(Valid with { AboutText = new string('a', 601) })["aboutText"].ShouldBe(["Keep this to 600 characters or fewer."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void ABlankStreetTownAndProvinceAreRefusedWithTheirOwnMessage(string? blank)
    {
        var fields = Fields(Valid with { Street = blank, TownOrCity = blank, Province = blank });

        fields["street"].ShouldBe(["Enter the street and barangay."]);
        fields["townOrCity"].ShouldBe(["Enter the town or city."]);
        fields["province"].ShouldBe(["Enter the province."]);
    }

    [Fact]
    public void TheStreetTownAndProvinceHaveTheirOwnLengthLimits()
    {
        Fields(Valid with { Street = new string('a', 120), TownOrCity = new string('a', 60), Province = new string('a', 60) }).ShouldBeEmpty();

        var fields = Fields(Valid with { Street = new string('a', 121), TownOrCity = new string('a', 61), Province = new string('a', 61) });

        fields["street"].ShouldBe(["Keep this to 120 characters or fewer."]);
        fields["townOrCity"].ShouldBe(["Keep this to 60 characters or fewer."]);
        fields["province"].ShouldBe(["Keep this to 60 characters or fewer."]);
    }

    [Theory]
    [InlineData("860")]
    [InlineData("86000")]
    [InlineData("86a0")]
    [InlineData("8 600")]
    [InlineData("٨٦٠٠")]
    public void APostalCodeThatIsNotFourDigitsIsRefused(string code) =>
        Fields(Valid with { PostalCode = code })["postalCode"].ShouldBe(["Use the 4-digit postal code, like 8600."]);

    [Fact]
    public void AFourDigitPostalCodeFitsAndAPaddedOneIsTrimmed() =>
        Fields(Valid with { PostalCode = " 8600 " }).ShouldBeEmpty();

    [Fact]
    public void EveryLinkRuleRefusesAValueOutsideItsAllowListWithItsOwnMessage()
    {
        var fields = Fields(Valid with
        {
            DirectionsUrl = "https://example.test/map",
            MapEmbedUrl = "https://example.test/embed",
            MessengerUrl = "https://example.test/csps",
            FacebookUrl = "https://example.test/csps",
            InstagramUrl = "https://example.test/csps",
            TiktokUrl = "https://example.test/csps",
        });

        fields.Keys.ShouldBe(["directionsUrl", "mapEmbedUrl", "messengerUrl", "facebookUrl", "instagramUrl", "tiktokUrl"], ignoreOrder: true);
        fields["directionsUrl"].ShouldBe(["Paste a Google Maps link, like https://maps.app.goo.gl/abc123."]);
        fields["mapEmbedUrl"].ShouldBe(["Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed."]);
        fields["messengerUrl"].ShouldBe(["Paste your Messenger link, like https://m.me/yourpage."]);
        fields["facebookUrl"].ShouldBe(["Paste your Facebook page link, like https://www.facebook.com/yourpage."]);
        fields["instagramUrl"].ShouldBe(["Paste your Instagram link, like https://www.instagram.com/yourpage."]);
        fields["tiktokUrl"].ShouldBe(["Paste your TikTok link, like https://www.tiktok.com/@yourpage."]);
    }

    [Theory]
    [InlineData("http://m.me/cspsdemo")]
    [InlineData("javascript:alert(1)")]
    [InlineData("[Facebook page URL]")]
    [InlineData("https://m.me/my page")]
    public void AnInsecureScriptPlaceholderOrSpacedLinkIsRefused(string link)
    {
        var fields = Fields(Valid with { MessengerUrl = link, FacebookUrl = link });

        fields["messengerUrl"].ShouldBe(["Paste your Messenger link, like https://m.me/yourpage."]);
        fields["facebookUrl"].ShouldBe(["Paste your Facebook page link, like https://www.facebook.com/yourpage."]);
    }

    [Fact]
    public void AnEmptyOptionalLinkIsNotChecked() =>
        Fields(Valid with { MessengerUrl = "  ", FacebookUrl = "", InstagramUrl = null, TiktokUrl = " ", DirectionsUrl = "", MapEmbedUrl = null }).ShouldBeEmpty();

    [Fact]
    public void ALinkWithPaddingIsCheckedAfterTrimming() =>
        Fields(Valid with { MessengerUrl = "  https://m.me/cspsdemo  " }).ShouldBeEmpty();

    [Fact]
    public void NoNumberAndANullListAreRefusedWithTheSameMessage()
    {
        Fields(Valid with { Phones = [] })["phones"].ShouldBe(["Add at least one phone number."]);
        Fields(Valid with { Phones = null })["phones"].ShouldBe(["Add at least one phone number."]);
    }

    [Fact]
    public void MoreThanFourNumbersAreRefused()
    {
        var five = Enumerable.Range(0, 5).Select(index => new PhoneEntry($"0917 123 456{index}", null, IsMain: index == 0)).ToList();

        Fields(Valid with { Phones = five })["phones"].ShouldBe(["You can list up to 4 numbers."]);
        Fields(Valid with { Phones = [.. five.Take(4)] }).ShouldBeEmpty();
    }

    [Fact]
    public void ABadNumberIsReportedOnItsOwnRowWithTheApprovedPhoneMessage()
    {
        var fields = Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", null, IsMain: true), new PhoneEntry("12345", null, IsMain: false), new PhoneEntry("[0917 000 0000]", null, IsMain: false)] });

        fields.Keys.ShouldBe(["phones[1].number", "phones[2].number"], ignoreOrder: true);
        fields["phones[1].number"].ShouldBe([PhoneMessage]);
        fields["phones[2].number"].ShouldBe([PhoneMessage]);
    }

    [Fact]
    public void ABlankNumberRowIsRefusedWithThePhoneMessage() =>
        Fields(Valid with { Phones = [new PhoneEntry(null, null, IsMain: true)] })["phones[0].number"].ShouldBe([PhoneMessage]);

    [Fact]
    public void ANullRowInTheListIsRefusedWithThePhoneMessage()
    {
        PhoneEntry[] rows = [new PhoneEntry("0917 123 4567", null, IsMain: true), null!];

        Fields(Valid with { Phones = rows })["phones[1].number"].ShouldBe([PhoneMessage]);
    }

    [Fact]
    public void TheSameNumberTypedTwoWaysIsListedTwice()
    {
        var fields = Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", null, IsMain: true), new PhoneEntry("+639171234567", null, IsMain: false)] });

        fields.Keys.ShouldBe(["phones[1].number"]);
        fields["phones[1].number"].ShouldBe(["This number is already listed."]);
    }

    [Fact]
    public void ALabelOver20CharactersIsReportedOnItsRow()
    {
        Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", new string('a', 20), IsMain: true)] }).ShouldBeEmpty();

        Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", new string('a', 21), IsMain: true)] })["phones[0].label"]
            .ShouldBe(["Keep the label to 20 characters or fewer."]);
    }

    [Fact]
    public void ABracketLabelIsRefused() =>
        Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", "[Globe]", IsMain: true)] })["phones[0].label"]
            .ShouldBe(["Replace the text in square brackets with the real words."]);

    [Fact]
    public void ZeroOrTwoMainNumbersAreRefusedWithChooseTheMainNumber()
    {
        Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", null, IsMain: false), new PhoneEntry("02 8123 4567", null, IsMain: false)] })["phones"]
            .ShouldBe(["Choose the main number."]);
        Fields(Valid with { Phones = [new PhoneEntry("0917 123 4567", null, IsMain: true), new PhoneEntry("02 8123 4567", null, IsMain: true)] })["phones"]
            .ShouldBe(["Choose the main number."]);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("a@b@c.test")]
    [InlineData("@example.test")]
    [InlineData("name@")]
    [InlineData("[hello@yourdomain.ph]")]
    public void ABadEmailIsRefused(string email) =>
        Fields(Valid with { ContactEmail = email })["contactEmail"].ShouldBe([EmailMessage]);

    [Fact]
    public void AnEmailOver254CharactersIsRefusedAndExactly254Fits()
    {
        var local = new string('a', 254 - "@example.test".Length);

        Fields(Valid with { ContactEmail = $"{local}@example.test" }).ShouldBeEmpty();
        Fields(Valid with { ContactEmail = $"{local}a@example.test" })["contactEmail"].ShouldBe([EmailMessage]);
    }

    [Fact]
    public void AnEmptyEmailIsAllowed() => Fields(Valid with { ContactEmail = "  " }).ShouldBeEmpty();

    [Theory]
    [InlineData("nope")]
    [InlineData("a@b@c.ph")]
    [InlineData("name@[example].ph")]
    [InlineData("@example.test")]
    [InlineData("name@")]
    [InlineData("[hello@yourdomain.ph]")]
    public void ABadQuoteAlertsEmailIsRefusedWithTheEmailMessage(string email) =>
        Fields(Valid with { QuoteAlertsEmail = email })["quoteAlertsEmail"].ShouldBe([EmailMessage]);

    [Fact]
    public void AQuoteAlertsEmailOver254CharactersGetsTheLengthMessageAndExactly254Fits()
    {
        var local = new string('a', 254 - "@example.test".Length);

        Fields(Valid with { QuoteAlertsEmail = $"{local}@example.test" }).ShouldBeEmpty();
        Fields(Valid with { QuoteAlertsEmail = $"{local}a@example.test" })["quoteAlertsEmail"].ShouldBe(["Keep the email to 254 characters or fewer."]);
        Fields(Valid with { QuoteAlertsEmail = $"{new string('a', 250)}@b.ph" })["quoteAlertsEmail"].ShouldBe(["Keep the email to 254 characters or fewer."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("  ")]
    public void AnEmptyOrMissingQuoteAlertsEmailIsAllowed(string? blank) =>
        Fields(Valid with { QuoteAlertsEmail = blank }).ShouldBeEmpty();

    [Fact]
    public void TheShopEmailIsAllowedAsTheQuoteAlertsEmail() =>
        Fields(Valid with { QuoteAlertsEmail = Valid.ContactEmail }).ShouldBeEmpty();

    [Fact]
    public void ABracketPlaceholderInATextFieldIsRefused()
    {
        var fields = Fields(Valid with
        {
            BusinessName = "[Business name]",
            Tagline = "Custom [your words] here",
            AboutText = "[About]",
            TurnaroundLine = "[Mockup time]",
            Street = "[Shop address]",
            TownOrCity = "[City]",
            Province = "[Province]",
        });

        fields.Keys.ShouldBe(["businessName", "tagline", "aboutText", "turnaroundLine", "street", "townOrCity", "province"], ignoreOrder: true);
        foreach (var messages in fields.Values)
        {
            messages.ShouldBe(["Replace the text in square brackets with the real words."]);
        }
    }

    [Fact]
    public void AFieldWithTwoProblemsShowsOnlyTheFirst() =>
        Fields(Valid with { Tagline = "[" + new string('a', 200) + "]" })["tagline"].ShouldBe(["Keep the tagline to 160 characters or fewer."]);

    private static IReadOnlyDictionary<string, string[]> Fields(UpdateSiteSettingsRequest request)
    {
        var result = Validator.Validate(request);
        return result.IsValid
            ? new Dictionary<string, string[]>()
            : ValidationResults.ToError(result, SiteContentErrors.InvalidCode, "Check the highlighted fields.").FieldErrors!;
    }
}
