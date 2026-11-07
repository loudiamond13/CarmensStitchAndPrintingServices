using Csps.Application.Money;
using Csps.Domain.Common;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-01: the balance of the six sums goes through the one domain formula, and the error values are fixed.</summary>
public sealed class StaffMoneySumsTests
{
    private static readonly Guid PersonId = Guid.Parse("22222222-2222-4222-8222-222222222222");

    [Fact]
    public void AllSixSourcesAddUpToTheExactBalance()
    {
        var sums = new StaffMoneySums(PersonId, "Paolo Garcia", 5000.00m, 1000.00m, 1200.00m, 250.00m, 300.00m, 100.00m);

        sums.Balance().ShouldBe(4150.00m);
    }

    [Fact]
    public void BothKindsOfExpenseTakeMoneyOffTheBalance()
    {
        new StaffMoneySums(PersonId, "Paolo Garcia", 0m, 0m, 0m, 10.00m, 20.00m, 0m).Balance().ShouldBe(-30.00m);
    }

    [Fact]
    public void AnEmptyPersonHasAZeroBalance()
    {
        new StaffMoneySums(PersonId, "Paolo Garcia", 0m, 0m, 0m, 0m, 0m, 0m).Balance().ShouldBe(0.00m);
    }

    [Fact]
    public void AOneCentavoRefundMovesTheBalanceByExactlyOneCentavo()
    {
        var before = new StaffMoneySums(PersonId, "Paolo Garcia", 10.00m, 0m, 0m, 0m, 0m, 0m).Balance();

        var after = new StaffMoneySums(PersonId, "Paolo Garcia", 10.00m, 0m, 0m, 0m, 0m, 0.01m).Balance();

        (before - after).ShouldBe(0.01m);
    }

    [Fact]
    public void TheMoneyErrorsCarryTheirCodesAndKinds()
    {
        MoneyErrors.NotFound.Kind.ShouldBe(ErrorKind.NotFound);
        MoneyErrors.NotFound.Code.ShouldStartWith("staff-money.");
        MoneyErrors.Forbidden.Kind.ShouldBe(ErrorKind.Forbidden);
        MoneyErrors.Forbidden.Code.ShouldStartWith("staff-money.");
        MoneyErrors.Busy.Kind.ShouldBe(ErrorKind.Conflict);
        MoneyErrors.Busy.Code.ShouldStartWith("money-transfers.");
        MoneyErrors.Busy.Message.ShouldBe("Something changed at the same time. Try again.");
    }
}
