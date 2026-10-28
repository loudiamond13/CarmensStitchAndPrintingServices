using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-14, D-23: the order number format, its parser and the per-year counter.</summary>
public sealed class OrderNumberTests
{
    [Theory]
    [InlineData(2026, 1, "ORD-2026-0001")]
    [InlineData(2026, 148, "ORD-2026-0148")]
    [InlineData(2026, 9999, "ORD-2026-9999")]
    [InlineData(2026, 10000, "ORD-2026-10000")]
    [InlineData(2027, 123456, "ORD-2027-123456")]
    public void TheSequenceHasAtLeastFourDigitsAndIsNeverCutShort(int year, int sequence, string expected) =>
        OrderNumber.Format(year, sequence).ShouldBe(expected);

    [Theory]
    [InlineData(2026, 1)]
    [InlineData(2026, 148)]
    [InlineData(2026, 10000)]
    [InlineData(1999, 99999)]
    public void AParsedNumberGivesBackTheYearAndSequenceItWasMadeFrom(int year, int sequence)
    {
        OrderNumber.TryParse(OrderNumber.Format(year, sequence), out var parsedYear, out var parsedSequence).ShouldBeTrue();

        parsedYear.ShouldBe(year);
        parsedSequence.ShouldBe(sequence);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("X")]
    [InlineData("ORD-26-1")]
    [InlineData("ORD-2026-01")]
    [InlineData("ORD-2026-0001-5")]
    [InlineData("ORD-2026")]
    [InlineData("ORD-20a6-0001")]
    [InlineData("ORD-2026-00x1")]
    [InlineData("ORD-2026--001")]
    [InlineData("ORD-2026-99999999999")]
    [InlineData("ord-2026-0001")]
    public void ATextThatIsNotANumberFailsAndLeavesZeros(string? text)
    {
        OrderNumber.TryParse(text, out var year, out var sequence).ShouldBeFalse();

        year.ShouldBe(0);
        sequence.ShouldBe(0);
    }

    [Fact]
    public void ACounterStartsAtZeroAndGivesOutOneThenTwo()
    {
        var counter = OrderNumberCounter.Start(2026);

        counter.Year.ShouldBe(2026);
        counter.LastValue.ShouldBe(0);
        counter.Next().ShouldBe(1);
        counter.Next().ShouldBe(2);
        counter.LastValue.ShouldBe(2);
    }

    [Fact]
    public void EnsureAtLeastLiftsTheCounterAndNeverLowersIt()
    {
        var counter = OrderNumberCounter.Start(2026);

        counter.EnsureAtLeast(148);
        counter.LastValue.ShouldBe(148);
        counter.EnsureAtLeast(10);
        counter.LastValue.ShouldBe(148);
        counter.Next().ShouldBe(149);
    }
}
