using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>ANL-08: list shares are whole percents that always add up to 100.</summary>
public sealed class SharesTests
{
    [Fact]
    public void ThreeEqualCountsGiveTheExtraPointToTheFirst()
    {
        Shares.LargestRemainder([1, 1, 1]).ShouldBe([34, 33, 33]);
    }

    [Fact]
    public void AnUnevenListAddsUpToOneHundred()
    {
        var shares = Shares.LargestRemainder([412, 300, 288]);

        shares.Sum().ShouldBe(100);
        shares.ShouldBe([41, 30, 29]);
    }

    [Fact]
    public void ASingleItemIsOneHundredPercent()
    {
        Shares.LargestRemainder([5]).ShouldBe([100]);
    }

    [Fact]
    public void AllZeroCountsGiveZeros()
    {
        Shares.LargestRemainder([0, 0]).ShouldBe([0, 0]);
    }

    [Fact]
    public void AnEmptyListGivesAnEmptyList()
    {
        Shares.LargestRemainder([]).ShouldBeEmpty();
    }

    [Fact]
    public void TwoToOneGivesSixtySevenAndThirtyThree()
    {
        Shares.LargestRemainder([2, 1]).ShouldBe([67, 33]);
    }

    [Fact]
    public void TheLargerRemainderWinsOverAnEarlierItem()
    {
        Shares.LargestRemainder([1, 2]).ShouldBe([33, 67]);
    }

    [Fact]
    public void ARemainderlessListKeepsItsExactPercents()
    {
        Shares.LargestRemainder([1, 1, 2]).ShouldBe([25, 25, 50]);
    }

    [Fact]
    public void ManyItemsStillAddUpToOneHundred()
    {
        Shares.LargestRemainder([1, 1, 1, 1, 1, 1, 1]).Sum().ShouldBe(100);
    }
}
