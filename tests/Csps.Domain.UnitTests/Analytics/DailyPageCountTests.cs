using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-06: the anonymous counter row starts at one view and holds only the day, the page key and the count.</summary>
public sealed class DailyPageCountTests
{
    private static readonly DateOnly Day = new(2026, 11, 17);

    [Fact]
    public void TheFirstViewHoldsTheDayThePageKeyAndACountOfOne()
    {
        var row = DailyPageCount.First(Day, PageKeys.Gallery);

        row.BusinessDay.ShouldBe(Day);
        row.PageKey.ShouldBe("gallery");
        row.Views.ShouldBe(1);
    }

    [Fact]
    public void AKeyAtTheLongestLengthIsKept()
    {
        var key = new string('a', PageKeys.MaxLength);

        DailyPageCount.First(Day, key).PageKey.ShouldBe(key);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankPageKeyIsRefused(string key)
    {
        Should.Throw<ArgumentException>(() => DailyPageCount.First(Day, key));
    }

    [Fact]
    public void ANullPageKeyIsRefused()
    {
        Should.Throw<ArgumentNullException>(() => DailyPageCount.First(Day, null!));
    }

    [Fact]
    public void APageKeyLongerThanTheColumnIsRefused()
    {
        Should.Throw<ArgumentException>(() => DailyPageCount.First(Day, new string('a', PageKeys.MaxLength + 1)));
    }

    [Fact]
    public void TheRowHoldsNothingAboutTheVisitor()
    {
        typeof(DailyPageCount).GetProperties().Select(property => property.Name).ShouldBe(["BusinessDay", "PageKey", "Views"], ignoreOrder: true);
    }
}
