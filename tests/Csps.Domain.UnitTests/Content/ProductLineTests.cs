using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-01, D-02, D-06: a line built from the seed carries every seeded value, a reset puts them all back, and a photo row keeps its slot and file facts.</summary>
public sealed class ProductLineTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 3, 0, 0, TimeSpan.Zero);

    private static readonly ProductLineSeedEntry Basketball = ProductLineSeed.All[0];

    [Fact]
    public void FromSeedCopiesEveryValueAndTheStamp()
    {
        var line = ProductLine.FromSeed(Basketball, 650.00m, 10, Now);

        line.Id.ShouldBe(Basketball.Id);
        line.Key.ShouldBe(Basketball.Key);
        line.Title.ShouldBe(Basketball.Title);
        line.ShortName.ShouldBe(Basketball.ShortName);
        line.Number.ShouldBe(Basketball.Number);
        line.CardText.ShouldBe(Basketball.CardText);
        line.Description.ShouldBe(Basketball.Description);
        line.FabricText.ShouldBe(Basketball.FabricText);
        line.CollarText.ShouldBe(Basketball.CollarText);
        line.CutText.ShouldBe(Basketball.CutText);
        line.NamesText.ShouldBe(Basketball.NamesText);
        line.LogosText.ShouldBe(Basketball.LogosText);
        line.StartsAtPrice.ShouldBe(650.00m);
        line.MinimumQuantity.ShouldBe(10);
        line.Position.ShouldBe(Basketball.Position);
        line.IsActive.ShouldBeTrue();
        line.PlaceholderArt.ShouldBe(PlaceholderArt.Basketball);
        line.CreatedAtUtc.ShouldBe(Now);
        line.UpdatedAtUtc.ShouldBeNull();
        line.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void ResetToSeedPutsEveryValueBack()
    {
        var other = ProductLineSeed.All[1];
        var line = ProductLine.FromSeed(other, 1m, 99, Now);

        line.ResetToSeed(Basketball, null, null);

        line.Key.ShouldBe(Basketball.Key);
        line.Title.ShouldBe(Basketball.Title);
        line.ShortName.ShouldBe(Basketball.ShortName);
        line.Number.ShouldBe(Basketball.Number);
        line.CardText.ShouldBe(Basketball.CardText);
        line.Description.ShouldBe(Basketball.Description);
        line.FabricText.ShouldBe(Basketball.FabricText);
        line.CollarText.ShouldBe(Basketball.CollarText);
        line.CutText.ShouldBe(Basketball.CutText);
        line.NamesText.ShouldBe(Basketball.NamesText);
        line.LogosText.ShouldBe(Basketball.LogosText);
        line.StartsAtPrice.ShouldBeNull();
        line.MinimumQuantity.ShouldBeNull();
        line.Position.ShouldBe(Basketball.Position);
        line.PlaceholderArt.ShouldBe(PlaceholderArt.Basketball);
    }

    [Fact]
    public void FromSeedAndResetToSeedRejectANullEntry()
    {
        Should.Throw<ArgumentNullException>(() => ProductLine.FromSeed(null!, null, null, Now));
        Should.Throw<ArgumentNullException>(() => ProductLine.FromSeed(Basketball, null, null, Now).ResetToSeed(null!, null, null));
    }

    [Fact]
    public void APhotoKeepsItsSlotAndFileFacts()
    {
        var lineId = Guid.CreateVersion7(Now);

        var photo = ProductLinePhoto.Create(lineId, ProductLinePhotoSlot.Back, "csps/lines/abc", 1200, 900, 345_678, "webp", Now);

        photo.Id.ShouldNotBe(Guid.Empty);
        photo.LineId.ShouldBe(lineId);
        photo.Slot.ShouldBe(ProductLinePhotoSlot.Back);
        photo.PublicId.ShouldBe("csps/lines/abc");
        photo.Width.ShouldBe(1200);
        photo.Height.ShouldBe(900);
        photo.Bytes.ShouldBe(345_678);
        photo.Format.ShouldBe("webp");
        photo.CreatedAtUtc.ShouldBe(Now);
        photo.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public void APhotoNeedsAFileIdAndAFormat()
    {
        Should.Throw<ArgumentNullException>(() => ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, null!, 1, 1, 1, "jpg", Now));
        Should.Throw<ArgumentNullException>(() => ProductLinePhoto.Create(Guid.NewGuid(), ProductLinePhotoSlot.Main, "id", 1, 1, 1, null!, Now));
    }

    private static ProductLineValues Valid { get; } = new(
        "Shorts", "Shorts", "7", "Light shorts for the team.", "Printed shorts.", "Mesh", "No collar", "Standard", "Any font", "Crest", null, null, false);

    private static Dictionary<string, string[]> Errors(ProductLineValues values) => ProductLine.Check(values);

    [Fact]
    public void AFormWithEveryRuleMetHasNoErrors() => Errors(Valid).ShouldBeEmpty();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ATitleIsRequired(string? title) =>
        Errors(Valid with { Title = title })["title"].ShouldBe(["Enter the title."]);

    [Fact]
    public void ATitleIsAtMostSixtyCharactersAfterTrimming()
    {
        Errors(Valid with { Title = new string('a', 60) }).ShouldNotContainKey("title");
        Errors(Valid with { Title = "  " + new string('a', 60) + "  " }).ShouldNotContainKey("title");
        Errors(Valid with { Title = new string('a', 61) })["title"].ShouldBe(["Keep the title to 60 characters or fewer."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(" ")]
    public void AShortNameIsRequired(string? shortName) =>
        Errors(Valid with { ShortName = shortName })["shortName"].ShouldBe(["Enter a short name."]);

    [Fact]
    public void AShortNameIsAtMostTwentyCharacters()
    {
        Errors(Valid with { ShortName = new string('a', 20) }).ShouldNotContainKey("shortName");
        Errors(Valid with { ShortName = new string('a', 21) })["shortName"].ShouldBe(["Keep the short name to 20 characters or fewer."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("23")]
    [InlineData("A1")]
    [InlineData("3X")]
    [InlineData("7")]
    [InlineData(" 3X ")]
    public void ANumberOfUpToTwoLettersOrDigitsIsFine(string? number) => Errors(Valid with { Number = number }).ShouldNotContainKey("number");

    [Theory]
    [InlineData("123")]
    [InlineData("$")]
    [InlineData("2-")]
    [InlineData("é1")]
    public void AnythingElseAsANumberIsRefused(string number) =>
        Errors(Valid with { Number = number })["number"].ShouldBe(["Use up to 2 letters or digits, like 23 or 3X."]);

    [Fact]
    public void TheCardTextAndTheDescriptionAreRequiredAndLimited()
    {
        Errors(Valid with { CardText = " " })["cardText"].ShouldBe(["Enter the card text."]);
        Errors(Valid with { CardText = new string('a', 140) }).ShouldNotContainKey("cardText");
        Errors(Valid with { CardText = new string('a', 141) })["cardText"].ShouldBe(["Keep the card text to 140 characters or fewer."]);
        Errors(Valid with { Description = null })["description"].ShouldBe(["Enter the description."]);
        Errors(Valid with { Description = new string('a', 300) }).ShouldNotContainKey("description");
        Errors(Valid with { Description = new string('a', 301) })["description"].ShouldBe(["Keep the description to 300 characters or fewer."]);
    }

    [Fact]
    public void EachCustomizeTextIsRequiredWithItsOwnTitleAndLimitedToOneHundredTwentyCharacters()
    {
        Errors(Valid with { FabricText = "" })["fabricText"].ShouldBe(["Enter the Fabric text."]);
        Errors(Valid with { CollarText = "" })["collarText"].ShouldBe(["Enter the Collar style text."]);
        Errors(Valid with { CutText = "" })["cutText"].ShouldBe(["Enter the Cut & fit text."]);
        Errors(Valid with { NamesText = "" })["namesText"].ShouldBe(["Enter the Names & numbers text."]);
        Errors(Valid with { LogosText = "" })["logosText"].ShouldBe(["Enter the Logos & sponsors text."]);
        Errors(Valid with { FabricText = new string('a', 120), LogosText = new string('a', 120) }).ShouldBeEmpty();
        Errors(Valid with { NamesText = new string('a', 121) })["namesText"].ShouldBe(["Keep this to 120 characters or fewer."]);
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("999999.99")]
    [InlineData("650")]
    [InlineData("650.000")]
    public void APriceFromOneCentToTheLimitIsFine(string price) =>
        Errors(Valid with { StartsAtPrice = decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture) }).ShouldNotContainKey("startsAtPrice");

    [Theory]
    [InlineData("0.00", "Enter a price of at least ₱0.01.")]
    [InlineData("-5", "Enter a price of at least ₱0.01.")]
    [InlineData("1000000.00", "Enter a price up to ₱999,999.99.")]
    [InlineData("999999.991", "Use at most 2 decimal places.")]
    [InlineData("1.234", "Use at most 2 decimal places.")]
    [InlineData("0.001", "Use at most 2 decimal places.")]
    public void APriceOutsideTheRulesGetsItsOwnMessage(string price, string message) =>
        Errors(Valid with { StartsAtPrice = decimal.Parse(price, System.Globalization.CultureInfo.InvariantCulture) })["startsAtPrice"].ShouldBe([message]);

    [Theory]
    [InlineData("1")]
    [InlineData("9999")]
    [InlineData("10")]
    public void AMinimumFromOneToNineThousandNineHundredNinetyNineIsFine(string minimum) =>
        Errors(Valid with { MinimumQuantity = decimal.Parse(minimum, System.Globalization.CultureInfo.InvariantCulture) }).ShouldNotContainKey("minimumQuantity");

    [Theory]
    [InlineData("0")]
    [InlineData("10000")]
    [InlineData("1.5")]
    [InlineData("-1")]
    public void AMinimumThatIsNotAWholeNumberFromOneToNineThousandNineHundredNinetyNineIsRefused(string minimum) =>
        Errors(Valid with { MinimumQuantity = decimal.Parse(minimum, System.Globalization.CultureInfo.InvariantCulture) })["minimumQuantity"].ShouldBe(["Enter a whole number from 1 to 9,999."]);

    [Fact]
    public void EveryBrokenFieldIsReportedAtOnce()
    {
        var errors = Errors(new ProductLineValues(null, null, "123", null, null, null, null, null, null, null, 0m, 0m, null));

        errors.Keys.ShouldBe(["title", "shortName", "number", "cardText", "description", "fabricText", "collarText", "cutText", "namesText", "logosText", "startsAtPrice", "minimumQuantity"]);
    }

    [Fact]
    public void CheckRejectsANullForm() => Should.Throw<ArgumentNullException>(() => ProductLine.Check(null!));

    [Fact]
    public void CreateBuildsAHiddenLineAtTheEndWithTheCustomDrawingAndTrimmedTexts()
    {
        var result = ProductLine.Create(Valid with { Title = "  Shorts  ", StartsAtPrice = 350m, MinimumQuantity = 12 }, "shorts", 7, Now);

        result.IsSuccess.ShouldBeTrue();
        var line = result.Value;
        line.Id.ShouldNotBe(Guid.Empty);
        line.Key.ShouldBe("shorts");
        line.Title.ShouldBe("Shorts");
        line.Position.ShouldBe(7);
        line.IsActive.ShouldBeFalse();
        line.PlaceholderArt.ShouldBe(PlaceholderArt.Custom);
        line.StartsAtPrice.ShouldBe(350m);
        line.MinimumQuantity.ShouldBe(12);
        line.CreatedAtUtc.ShouldBe(Now);
        line.RowVersion.ShouldBeEmpty();
    }

    [Fact]
    public void CreateShowsTheLineWhenAskedTo() =>
        ProductLine.Create(Valid with { IsActive = true }, "shorts", 7, Now).Value.IsActive.ShouldBeTrue();

    [Fact]
    public void CreateRefusesABrokenFormNamingEveryField()
    {
        var result = ProductLine.Create(Valid with { Title = "", CardText = "" }, "shorts", 7, Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors!.Keys.ShouldBe(["title", "cardText"]);
    }

    [Fact]
    public void CreateGuardsItsArguments()
    {
        Should.Throw<ArgumentNullException>(() => ProductLine.Create(null!, "shorts", 7, Now));
        Should.Throw<ArgumentException>(() => ProductLine.Create(Valid, "Bad Key", 7, Now));
        Should.Throw<ArgumentOutOfRangeException>(() => ProductLine.Create(Valid, "shorts", 0, Now));
    }

    [Fact]
    public void UpdateNamesEachChangedFieldInFormOrderAndKeepsTheKey()
    {
        var line = ProductLine.Create(Valid, "shorts", 7, Now).Value;

        var result = line.Update(Valid with { Title = "Short Shorts", ShortName = "Short", Number = "8", CardText = "New card", Description = "New description", FabricText = "New fabric", CollarText = "New collar", CutText = "New cut", NamesText = "New names", LogosText = "New logos", StartsAtPrice = 350m, MinimumQuantity = 12 });

        result.IsSuccess.ShouldBeTrue();
        var changes = result.Value;
        changes.Fields.ShouldBe(["title", "shortName", "number", "cardText", "description", "fabricText", "collarText", "cutText", "namesText", "logosText", "startsAtPrice", "minimumQuantity"]);
        (changes.OldTitle, changes.NewTitle).ShouldBe(("Shorts", "Short Shorts"));
        (changes.OldShortName, changes.NewShortName).ShouldBe(("Shorts", "Short"));
        (changes.OldPrice, changes.NewPrice).ShouldBe((null, 350m));
        (changes.OldMinimum, changes.NewMinimum).ShouldBe((null, 12));
        changes.NowShown.ShouldBeNull();
        changes.HasChange.ShouldBeTrue();
        line.Key.ShouldBe("shorts");
        line.Title.ShouldBe("Short Shorts");
    }

    [Fact]
    public void UpdateWithTheSameValuesChangesNothing()
    {
        var line = ProductLine.Create(Valid with { StartsAtPrice = 350m, MinimumQuantity = 12 }, "shorts", 7, Now).Value;

        var changes = line.Update(Valid with { Title = " Shorts ", StartsAtPrice = 350.00m, MinimumQuantity = 12m }).Value;

        changes.Fields.ShouldBeEmpty();
        changes.NowShown.ShouldBeNull();
        changes.HasChange.ShouldBeFalse();
    }

    [Fact]
    public void UpdateClearsAPriceAndAMinimum()
    {
        var line = ProductLine.Create(Valid with { StartsAtPrice = 350m, MinimumQuantity = 12 }, "shorts", 7, Now).Value;

        var changes = line.Update(Valid).Value;

        changes.Fields.ShouldBe(["startsAtPrice", "minimumQuantity"]);
        line.StartsAtPrice.ShouldBeNull();
        line.MinimumQuantity.ShouldBeNull();
    }

    [Fact]
    public void UpdateReportsAChangeOfTheShownFlagAndLeavesItAloneWhenNotSent()
    {
        var line = ProductLine.Create(Valid, "shorts", 7, Now).Value;

        var shown = line.Update(Valid with { IsActive = true }).Value;
        var untouched = line.Update(Valid with { IsActive = null }).Value;
        var same = line.Update(Valid with { IsActive = true }).Value;
        var hidden = line.Update(Valid with { IsActive = false }).Value;

        shown.NowShown.ShouldBe(true);
        shown.HasChange.ShouldBeTrue();
        shown.Fields.ShouldBeEmpty();
        untouched.HasChange.ShouldBeFalse();
        same.HasChange.ShouldBeFalse();
        hidden.NowShown.ShouldBe(false);
        line.IsActive.ShouldBeFalse();
    }

    [Fact]
    public void UpdateRefusesABrokenFormAndChangesNothing()
    {
        var line = ProductLine.Create(Valid, "shorts", 7, Now).Value;

        var result = line.Update(Valid with { Title = "Changed", CardText = "" });

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors!.Keys.ShouldBe(["cardText"]);
        line.Title.ShouldBe("Shorts");
        Should.Throw<ArgumentNullException>(() => line.Update(null!));
    }

    [Fact]
    public void HideAndShowReportWhetherTheyChangedTheLine()
    {
        var line = ProductLine.Create(Valid with { IsActive = true }, "shorts", 7, Now).Value;

        line.Hide().ShouldBeTrue();
        line.Hide().ShouldBeFalse();
        line.IsActive.ShouldBeFalse();
        line.Show().ShouldBeTrue();
        line.Show().ShouldBeFalse();
        line.IsActive.ShouldBeTrue();
    }

    [Fact]
    public void TwoLinesTradePlacesInTheOrder()
    {
        var first = ProductLine.Create(Valid, "first", 1, Now).Value;
        var second = ProductLine.Create(Valid, "second", 2, Now).Value;

        first.SwapPositionWith(second);

        first.Position.ShouldBe(2);
        second.Position.ShouldBe(1);
        Should.Throw<ArgumentNullException>(() => first.SwapPositionWith(null!));
    }
}
