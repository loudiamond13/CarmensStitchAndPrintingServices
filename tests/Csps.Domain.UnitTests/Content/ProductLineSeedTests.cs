using System.Text.RegularExpressions;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>D-06, D-07, D-40, OR-4: the six seeded lines are the approved text, each fits its column, and none carries a price, a minimum or a long dash.</summary>
public sealed class ProductLineSeedTests
{
    private static readonly string[] Keys = ["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"];

    [Fact]
    public void ThereAreSixLinesInTheApprovedOrder() => ProductLineSeed.All.Select(line => line.Key).ShouldBe(Keys);

    [Fact]
    public void PositionsRunFromOneToSixInOrder() => ProductLineSeed.All.Select(line => line.Position).ShouldBe([1, 2, 3, 4, 5, 6]);

    [Fact]
    public void IdsKeysAndShortNamesAreUnique()
    {
        ProductLineSeed.All.Select(line => line.Id).Distinct().Count().ShouldBe(6);
        ProductLineSeed.All.Select(line => line.Key).Distinct().Count().ShouldBe(6);
        ProductLineSeed.All.Select(line => line.ShortName).Distinct(StringComparer.OrdinalIgnoreCase).Count().ShouldBe(6);
    }

    [Fact]
    public void EveryTextFitsItsColumn()
    {
        foreach (var line in ProductLineSeed.All)
        {
            line.Key.Length.ShouldBeInRange(1, ProductLine.KeyMaxLength);
            line.Title.Length.ShouldBeInRange(1, ProductLine.TitleMaxLength);
            line.ShortName.Length.ShouldBeInRange(1, ProductLine.ShortNameMaxLength);
            line.Number.Length.ShouldBeInRange(1, ProductLine.NumberMaxLength);
            line.CardText.Length.ShouldBeInRange(1, ProductLine.CardTextMaxLength);
            line.Description.Length.ShouldBeInRange(1, ProductLine.DescriptionMaxLength);
            new[] { line.FabricText, line.CollarText, line.CutText, line.NamesText, line.LogosText }
                .ShouldAllBe(text => text.Length >= 1 && text.Length <= ProductLine.CustomizeTextMaxLength);
        }
    }

    [Fact]
    public void NoTextHasAnEmDashOrAnEnDash()
    {
        foreach (var line in ProductLineSeed.All)
        {
            new[]
            {
                line.Key, line.Title, line.ShortName, line.Number, line.CardText, line.Description,
                line.FabricText, line.CollarText, line.CutText, line.NamesText, line.LogosText,
            }.ShouldAllBe(text => !text.Contains('—', StringComparison.Ordinal) && !text.Contains('–', StringComparison.Ordinal));
        }
    }

    [Fact]
    public void EveryLineHasItsOwnDrawingAndANumberOfDigits()
    {
        ProductLineSeed.All.Select(line => line.PlaceholderArt).ShouldBe(
            [PlaceholderArt.Basketball, PlaceholderArt.Volleyball, PlaceholderArt.Moto, PlaceholderArt.LongSleeves, PlaceholderArt.Polo, PlaceholderArt.Custom]);
        ProductLineSeed.All.ShouldAllBe(line => Regex.IsMatch(line.Number, "^[0-9]{2}$", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)));
    }

    [Fact]
    public void ThePriceLimitsAreTheDocumentedOnes()
    {
        ProductLine.MinPrice.ShouldBe(0.01m);
        ProductLine.MaxPrice.ShouldBe(999_999.99m);
        ProductLine.MinQuantity.ShouldBe(1);
        ProductLine.MaxQuantity.ShouldBe(9_999);
    }

    [Fact]
    public void TheSeededRowsAreStampedWithTheFixedDate() => ProductLineSeed.SeededAtUtc.ShouldBe(new DateTimeOffset(2026, 11, 11, 0, 0, 0, TimeSpan.Zero));

    [Fact]
    public void ALineBuiltFromTheSeedIsShownWithNoPriceAndNoMinimum()
    {
        foreach (var entry in ProductLineSeed.All)
        {
            var line = ProductLine.FromSeed(entry, null, null, ProductLineSeed.SeededAtUtc);

            line.StartsAtPrice.ShouldBeNull();
            line.MinimumQuantity.ShouldBeNull();
            line.IsActive.ShouldBeTrue();
            line.Title.ShouldBe(entry.Title);
        }
    }
}
