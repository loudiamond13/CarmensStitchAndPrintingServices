using Csps.Application.Money;
using Csps.Domain.Expenses;
using Csps.Domain.Identity;
using Csps.Domain.Orders;
using Csps.Infrastructure.Money;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Money;

/// <summary>MONEY-01, D-15, D-16, D-23, A3: money on hand is six sums read on every request, exact across every source and every delete.</summary>
public sealed class StaffMoneyReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Day = new(2026, 10, 20);
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    private int _orderCounter;

    [Fact]
    public async Task AllSixSourcesAddUpToTheExactBalance()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now, "Garcia");
        var liza = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        await SeedPaoloAsync(paolo, liza);

        var sums = (await ReadAsync(paolo)).Single();

        sums.UserId.ShouldBe(paolo);
        sums.Name.ShouldBe("Paolo Garcia");
        sums.Received.ShouldBe(5000.00m);
        sums.TransfersIn.ShouldBe(1000.00m);
        sums.TransfersOut.ShouldBe(1200.00m);
        sums.CompanyExpensesPaid.ShouldBe(300.00m);
        sums.OrderExpensesPaid.ShouldBe(250.00m);
        sums.RefundsHandedBack.ShouldBe(100.00m);
        sums.Balance().ShouldBe(4150.00m);
    }

    [Fact]
    public async Task DeletingTheOrderThatHeldTheFivePaymentsTakesThePersonBelowZero()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now, "Garcia");
        var liza = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        var held = await SeedPaoloAsync(paolo, liza);
        await DeleteOrderAsync(held);

        var sums = (await ReadAsync(paolo)).Single();

        sums.Received.ShouldBe(0.00m);
        sums.Balance().ShouldBe(-850.00m);
    }

    [Fact]
    public async Task ADeletedOrderTakesItsPaymentRefundAndOrderExpenseOutTogether()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        var order = await AddOrderAsync(paolo, payments: [500.00m], refunds: [40.00m], expenses: [30.00m]);
        (await ReadAsync(paolo)).Single().Balance().ShouldBe(430.00m);

        await DeleteOrderAsync(order);

        var sums = (await ReadAsync(paolo)).Single();
        sums.Received.ShouldBe(0.00m);
        sums.RefundsHandedBack.ShouldBe(0.00m);
        sums.OrderExpensesPaid.ShouldBe(0.00m);
    }

    [Fact]
    public async Task ADeletedTransferNoLongerCountsForEitherPerson()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        var liza = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(liza, paolo, 700.00m, Day), Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(liza, paolo, 300.00m, Day) { Deleted = true }, Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(paolo, liza, 100.00m, Day) { Deleted = true }, Now);

        var sums = await ReadAsync(paolo, liza);

        var forPaolo = sums.Single(row => row.UserId == paolo);
        var forLiza = sums.Single(row => row.UserId == liza);
        forPaolo.TransfersIn.ShouldBe(700.00m);
        forPaolo.TransfersOut.ShouldBe(0.00m);
        forLiza.TransfersOut.ShouldBe(700.00m);
        forLiza.TransfersIn.ShouldBe(0.00m);
    }

    [Fact]
    public async Task ADeletedCompanyExpenseNoLongerCounts()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        await AddCompanyExpenseAsync(paolo, 120.00m, deleted: false);
        await AddCompanyExpenseAsync(paolo, 80.00m, deleted: true);

        var sums = (await ReadAsync(paolo)).Single();

        sums.CompanyExpensesPaid.ShouldBe(120.00m);
        sums.Balance().ShouldBe(-120.00m);
    }

    [Fact]
    public async Task AnExpenseLargerThanWhatThePayerHoldsMakesTheBalanceNegative()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        await AddOrderAsync(paolo, payments: [100.00m], refunds: [], expenses: []);
        await AddCompanyExpenseAsync(paolo, 450.00m, deleted: false);

        (await ReadAsync(paolo)).Single().Balance().ShouldBe(-350.00m);
    }

    [Fact]
    public async Task AnEmptyPersonSumsToZeroInEveryColumn()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);

        var sums = (await ReadAsync(paolo)).Single();

        sums.ShouldBe(new StaffMoneySums(paolo, "Paolo Mercado", 0m, 0m, 0m, 0m, 0m, 0m));
        sums.Balance().ShouldBe(0.00m);
    }

    [Fact]
    public async Task AOneCentavoRefundMovesTheBalanceByExactlyOneCentavo()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        await AddOrderAsync(paolo, payments: [10.00m], refunds: [], expenses: []);
        (await ReadAsync(paolo)).Single().Balance().ShouldBe(10.00m);

        await AddOrderAsync(paolo, payments: [5.00m], refunds: [0.01m], expenses: []);

        (await ReadAsync(paolo)).Single().Balance().ShouldBe(14.99m);
    }

    [Fact]
    public async Task AHandoverLowersTheLeaverAndRaisesTheRecipientAndLeavesTheManagerWhoRecordedItUntouched()
    {
        await database.ResetAsync();
        var jomar = await OrderSeeding.AddStaffAsync(database, "Jomar", Now);
        var liza = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        var carmen = await OrderSeeding.AddStaffAsync(database, "Carmen", Now);
        await AddOrderAsync(jomar, payments: [900.00m], refunds: [], expenses: []);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(jomar, liza, 600.00m, Day) { IsHandover = true, CreatedById = carmen }, Now);

        var sums = await ReadAsync(jomar, liza, carmen);

        sums.Single(row => row.UserId == jomar).Balance().ShouldBe(300.00m);
        sums.Single(row => row.UserId == liza).Balance().ShouldBe(600.00m);
        sums.Single(row => row.UserId == carmen).ShouldBe(new StaffMoneySums(carmen, "Carmen Mercado", 0m, 0m, 0m, 0m, 0m, 0m));
    }

    [Fact]
    public async Task TheLegacyHolderAskedForReturnsNoRow()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);

        var sums = await ReadAsync(paolo, LegacyHolder.Id);

        sums.Select(row => row.UserId).ShouldBe([paolo]);
    }

    [Fact]
    public async Task AnIdThatIsNoUserReturnsNoRow()
    {
        await database.ResetAsync();

        (await ReadAsync(Guid.NewGuid())).ShouldBeEmpty();
    }

    [Fact]
    public async Task SeveralPeopleAreReadInOneStatement()
    {
        await database.ResetAsync();
        var paolo = await OrderSeeding.AddStaffAsync(database, "Paolo", Now);
        var liza = await OrderSeeding.AddStaffAsync(database, "Liza", Now);
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var reader = new StaffMoneyReader(context);

        counter.Reset();
        var sums = await reader.GetSumsAsync([paolo, liza], TestContext.Current.CancellationToken);

        sums.Count.ShouldBe(2);
        counter.Count.ShouldBe(1);
    }

    // Paolo: payments 5,000 on one order; transfers in 1,000 and out 1,200; company expense 300; on a second order a 250 expense and a 100 refund.
    private async Task<Guid> SeedPaoloAsync(Guid paolo, Guid liza)
    {
        var held = await AddOrderAsync(paolo, payments: [5000.00m], refunds: [], expenses: []);
        await AddOrderAsync(paolo, payments: [], refunds: [100.00m], expenses: [250.00m]);
        await AddCompanyExpenseAsync(paolo, 300.00m, deleted: false);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(liza, paolo, 1000.00m, Day), Now);
        await MoneySeeding.AddTransferAsync(database, new SeedTransfer(paolo, liza, 1200.00m, Day), Now);
        return held;
    }

    private async Task<IReadOnlyList<StaffMoneySums>> ReadAsync(params Guid[] ids)
    {
        await using var context = database.CreateContext();
        return await new StaffMoneyReader(context).GetSumsAsync(ids, TestContext.Current.CancellationToken);
    }

    private async Task<Guid> AddOrderAsync(Guid staffId, decimal[] payments, decimal[] refunds, decimal[] expenses)
    {
        var number = $"ORD-2026-{Interlocked.Increment(ref _orderCounter):D4}";
        return await OrderSeeding.AddAsync(
            database,
            new SeedOrder(number, OrderStatus.Pending)
            {
                Total = 50000.00m,
                Payments = [.. payments.Select(amount => new SeedMoney(Day, amount))],
                Refunds = [.. refunds.Select(amount => new SeedMoney(Day, amount))],
                Expenses = [.. expenses.Select(amount => new SeedMoney(Day, amount))],
            },
            staffId,
            Now);
    }

    private async Task AddCompanyExpenseAsync(Guid payerId, decimal amount, bool deleted)
    {
        var created = CompanyExpense.Create(Day, ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id, "Thread", amount, payerId, null, Day, Now);
        var expense = created.Value;
        await using var context = database.CreateContext();
        context.CompanyExpenses.Add(expense);
        var entry = context.Entry(expense);
        entry.Property(row => row.CreatedById).CurrentValue = payerId;
        entry.Property(row => row.CreatedAtUtc).CurrentValue = Now;
        if (deleted)
        {
            entry.Property(row => row.DeletedAtUtc).CurrentValue = Now.AddMinutes(1);
            entry.Property(row => row.DeletedById).CurrentValue = payerId;
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task DeleteOrderAsync(Guid orderId)
    {
        await using var context = database.CreateContext();
        await context.Orders.Where(row => row.Id == orderId)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.DeletedAtUtc, Now), TestContext.Current.CancellationToken);
    }
}
