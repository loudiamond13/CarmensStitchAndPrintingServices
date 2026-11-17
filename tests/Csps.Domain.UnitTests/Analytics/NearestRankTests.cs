using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-09: the 75th percentile index is ceil(0.75 x n) - 1.</summary>
public sealed class NearestRankTests
{
    [Theory]
    [InlineData(1, 0)]
    [InlineData(2, 1)]
    [InlineData(3, 2)]
    [InlineData(4, 2)]
    [InlineData(5, 3)]
    [InlineData(8, 5)]
    [InlineData(100, 74)]
    [InlineData(101, 75)]
    public void TheSeventyFifthPercentileIndexIsTheCeilingOfThreeQuartersMinusOne(int count, int expected)
    {
        NearestRank.Index(count, 0.75m).ShouldBe(expected);
    }

    [Fact]
    public void AnEmptyListHasNoIndex()
    {
        NearestRank.Index(0, 0.75m).ShouldBeNull();
    }

    [Fact]
    public void TheFiftiethAndHundredthPercentilesPickTheMiddleAndTheLast()
    {
        NearestRank.Index(4, 0.5m).ShouldBe(1);
        NearestRank.Index(4, 1m).ShouldBe(3);
    }
}
