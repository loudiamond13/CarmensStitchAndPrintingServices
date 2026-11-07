using Csps.Domain.Money;

namespace Csps.Domain.UnitTests.Money;

/// <summary>MONEY-01, D-15, D-16: money on hand is one sum, in exact decimals, and may be below zero.</summary>
public sealed class MoneyOnHandTests
{
    [Fact]
    public void ItAddsWhatCameInAndTakesAwayWhatWentOut()
    {
        MoneyOnHand.Of(1000m, 200m, 300m, 150m, 50m).ShouldBe(700.00m);
    }

    [Fact]
    public void ItCanBeBelowZeroWhenSomeoneIsOwedMoney()
    {
        MoneyOnHand.Of(0m, 0m, 0m, 500m, 0m).ShouldBe(-500.00m);
    }

    [Fact]
    public void ItUsesExactDecimalArithmetic()
    {
        MoneyOnHand.Of(0.1m, 0.2m, 0m, 0m, 0m).ShouldBe(0.3m);
    }

    [Fact]
    public void EachPartCountsOnItsOwn()
    {
        MoneyOnHand.Of(5m, 0m, 0m, 0m, 0m).ShouldBe(5m);
        MoneyOnHand.Of(0m, 5m, 0m, 0m, 0m).ShouldBe(5m);
        MoneyOnHand.Of(0m, 0m, 5m, 0m, 0m).ShouldBe(-5m);
        MoneyOnHand.Of(0m, 0m, 0m, 5m, 0m).ShouldBe(-5m);
        MoneyOnHand.Of(0m, 0m, 0m, 0m, 5m).ShouldBe(-5m);
    }
}
