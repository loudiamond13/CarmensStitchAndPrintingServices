using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>The peso text used in every domain message that names an amount.</summary>
public sealed class PesosTests
{
    [Theory]
    [InlineData("9327.50", "₱9,327.50")]
    [InlineData("1000000", "₱1,000,000.00")]
    [InlineData("0.01", "₱0.01")]
    [InlineData("0", "₱0.00")]
    public void FormatsWithTwoDecimalsAndGrouping(string amount, string expected) =>
        Pesos.Format(decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture)).ShouldBe(expected);
}
