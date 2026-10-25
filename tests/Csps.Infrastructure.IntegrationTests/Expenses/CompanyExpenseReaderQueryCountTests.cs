using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Expenses;

/// <summary>PERF-04: the expense reader runs a fixed number of SQL commands whatever the page size, and its compiled reads keep their answers.</summary>
public sealed class CompanyExpenseReaderQueryCountTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int RowCount = 150;
    private static readonly DateOnly WindowStart = new(2026, 9, 1);
    private static readonly DateOnly WindowEnd = new(2026, 10, 30);
    private static readonly Guid SuppliesId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id;
    private static readonly Guid RentId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Rent").Id;

    private static readonly KpiMonths Months = new(new DateOnly(2026, 10, 1), new DateOnly(2026, 10, 31), new DateOnly(2026, 9, 1), new DateOnly(2026, 9, 30));

    [Fact]
    public async Task APageOfTenRunsExactlyTwoCommands()
    {
        var rows = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var page = await new CompanyExpenseReader(context).ListAsync(Query(10), TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.Count.ShouldBe(10);
        page.Total.ShouldBe(RowCount);
        page.PeriodTotal.ShouldBe(rows.Sum(row => row.Amount));
    }

    [Fact]
    public async Task APageOfOneHundredRunsExactlyTwoCommands()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var page = await new CompanyExpenseReader(context).ListAsync(Query(100), TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.Count.ShouldBe(100);
    }

    [Fact]
    public async Task ASearchAndACategoryFilterStillRunExactlyTwoCommands()
    {
        var rows = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var query = Query(100) with { CategoryId = SuppliesId, Search = "Paolo" };

        counter.Reset();
        var page = await new CompanyExpenseReader(context).ListAsync(query, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Total.ShouldBe(rows.Count(row => row.CategoryId == SuppliesId));
    }

    [Fact]
    public async Task AnEmptyResultStillRunsExactlyTwoCommands()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var query = Query(10) with { From = new DateOnly(2025, 1, 1), To = new DateOnly(2025, 1, 31) };

        counter.Reset();
        var page = await new CompanyExpenseReader(context).ListAsync(query, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        page.Items.ShouldBeEmpty();
        page.Total.ShouldBe(0);
        page.PeriodTotal.ShouldBe(0m);
    }

    [Fact]
    public async Task TheKpisRunExactlyTwoCommandsAndKeepTheirFigures()
    {
        var rows = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var totals = await new CompanyExpenseReader(context).GetKpisAsync(Months, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(2);
        var thisMonth = rows.Where(row => row.Date >= Months.ThisFirst && row.Date <= Months.ThisLast).ToList();
        var lastMonth = rows.Where(row => row.Date >= Months.LastFirst && row.Date <= Months.LastLast).ToList();
        totals.ThisMonthTotal.ShouldBe(thisMonth.Sum(row => row.Amount));
        totals.ThisMonthCount.ShouldBe(thisMonth.Count);
        totals.LastMonthTotal.ShouldBe(lastMonth.Sum(row => row.Amount));
        totals.LastMonthCount.ShouldBe(lastMonth.Count);
        var expectedTop = thisMonth
            .GroupBy(row => row.CategoryId)
            .Select(group => new { Id = group.Key, Total = group.Sum(row => row.Amount), Name = group.Key == SuppliesId ? "Supplies" : "Rent" })
            .OrderByDescending(group => group.Total)
            .ThenBy(group => group.Name, StringComparer.Ordinal)
            .First();
        totals.TopCategory.ShouldNotBeNull().Id.ShouldBe(expectedTop.Id);
        totals.TopTotal.ShouldBe(expectedTop.Total);
    }

    [Fact]
    public async Task TheDetailRunsExactlyOneCommandAndKeepsItsFigures()
    {
        var rows = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var wanted = rows[7];

        counter.Reset();
        var detail = await new CompanyExpenseReader(context).GetDetailAsync(wanted.Id, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(1);
        var found = detail.ShouldNotBeNull();
        found.Id.ShouldBe(wanted.Id);
        found.Date.ShouldBe(wanted.Date);
        found.Amount.ShouldBe(wanted.Amount);
        found.Category.Id.ShouldBe(wanted.CategoryId);
        found.PaidBy.Name.ShouldBe("Paolo Reyes");
        found.Description.ShouldBe(wanted.Description);
    }

    [Fact]
    public async Task ADeletedOrUnknownExpenseIsNotFoundInOneCommand()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var detail = await new CompanyExpenseReader(context).GetDetailAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(1);
        detail.ShouldBeNull();
    }

    private static CompanyExpenseListQuery Query(int pageSize) => new(WindowStart, WindowEnd, null, null, 1, pageSize);

    // 150 live expenses on 60 days from 1 September, alternating Supplies and Rent, one payer who is also the recorder.
    private async Task<List<SeededRow>> SeedAsync()
    {
        await database.ResetAsync();
        var payer = await NewUserAsync();
        var recorded = new DateTimeOffset(2026, 10, 25, 4, 0, 0, TimeSpan.Zero);
        var seeded = new List<SeededRow>();

        var context = database.CreateContext();
        await using (context)
        {
            for (var index = 0; index < RowCount; index++)
            {
                var date = WindowStart.AddDays(index % 60);
                var category = index % 2 == 0 ? SuppliesId : RentId;
                var amount = 100m + (index % 11 * 12.5m);
                var description = $"Expense {index:000}";
                var expense = CompanyExpense.Create(date, category, description, amount, payer, null, date, recorded).Value;
                context.CompanyExpenses.Add(expense);
                var entry = context.Entry(expense);
                entry.Property(row => row.CreatedById).CurrentValue = payer;
                entry.Property(row => row.CreatedAtUtc).CurrentValue = recorded.AddMinutes(index);
                seeded.Add(new SeededRow(expense.Id, date, category, amount, description));
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        return seeded;
    }

    private async Task<Guid> NewUserAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            var email = $"expense.{Guid.NewGuid():N}@example.com";
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = "Paolo",
                LastName = "Reyes",
            };
            context.Users.Add(user);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            return user.Id;
        }
    }

    private sealed record SeededRow(Guid Id, DateOnly Date, Guid CategoryId, decimal Amount, string Description);
}
