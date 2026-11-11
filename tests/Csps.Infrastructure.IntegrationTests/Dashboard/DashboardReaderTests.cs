using Csps.Application.Dashboard;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;
using Csps.Infrastructure.Dashboard;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Dashboard;

/// <summary>DASH-01, DASH-02, D-01 to D-05, D-11, D-55: the dashboard reader's figures follow the owner's rules at week, month and month-end boundaries.</summary>
public sealed class DashboardReaderTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // 10:00 in the fixed UTC+8 business zone on Wednesday 2026-11-04.
    private static readonly DateTimeOffset Wednesday = new(2026, 11, 4, 2, 0, 0, TimeSpan.Zero);

    // 10:00 on Tuesday 2026-03-31.
    private static readonly DateTimeOffset MarchThirtyFirst = new(2026, 3, 31, 2, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task DueThisWeekCountsActiveOrdersDueMondayToSundayThatAreNotOverdue()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { DueDate = Day(11, 5) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Delivered) { DueDate = Day(11, 2) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending) { DueDate = Day(11, 2) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0004", OrderStatus.Pending) { DueDate = Day(11, 9) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0005", OrderStatus.Pending) { DueDate = Day(11, 8) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0006", OrderStatus.Pending) { DueDate = Day(11, 4) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0007", OrderStatus.Pending));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0008", OrderStatus.Completed) { DueDate = Day(11, 5) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0009", OrderStatus.Pending) { DueDate = Day(11, 5), Deleted = true });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0010", OrderStatus.Mockup) { DueDate = new DateOnly(2026, 10, 26) });

        var figures = await rig.ReadAsync();

        figures.DueThisWeek.ShouldBe(4);
    }

    [Fact]
    public async Task AtMondayMidnightManilaTheWeekStartsThatMondayAndSundayIsOverdue()
    {
        // Sunday 16:00 UTC is Monday 2026-11-02 00:00 in Manila.
        var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 1, 16, 0, 0, TimeSpan.Zero));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { DueDate = Day(11, 1) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Pending) { DueDate = Day(11, 2) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending) { DueDate = Day(11, 8) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0004", OrderStatus.Pending) { DueDate = Day(11, 9) });

        var figures = await rig.ReadAsync();

        figures.DueThisWeek.ShouldBe(2);
        figures.Overdue.ShouldBe(1);
    }

    [Fact]
    public async Task AtSunday2359ManilaTheWeekStillHoldsThatSundaysOrders()
    {
        // Sunday 15:59 UTC is Sunday 2026-11-08 23:59 in Manila.
        var rig = await Rig.StartAsync(database, new DateTimeOffset(2026, 11, 8, 15, 59, 0, TimeSpan.Zero));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { DueDate = Day(11, 7) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Pending) { DueDate = Day(11, 8) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending) { DueDate = Day(11, 9) });

        var figures = await rig.ReadAsync();

        figures.DueThisWeek.ShouldBe(1);
        figures.Overdue.ShouldBe(1);
    }

    [Fact]
    public async Task OverdueCountsOpenOrdersDueBeforeTodayAndNeverDeliveredOrEndedOnes()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { DueDate = Day(11, 2) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Ready) { DueDate = new DateOnly(2026, 10, 30) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Mockup) { DueDate = Day(11, 3) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0004", OrderStatus.InProduction) { DueDate = Day(11, 4) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0005", OrderStatus.Delivered) { DueDate = new DateOnly(2026, 10, 30) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0006", OrderStatus.Completed) { DueDate = new DateOnly(2026, 10, 30) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0007", OrderStatus.Cancelled) { DueDate = new DateOnly(2026, 10, 30) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0008", OrderStatus.Pending));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0009", OrderStatus.Pending) { DueDate = new DateOnly(2026, 10, 30), Deleted = true });

        var figures = await rig.ReadAsync();

        figures.Overdue.ShouldBe(3);
    }

    [Fact]
    public async Task ReceivablesSumTheOwedBalanceOfActiveOrdersAndLeaveOutOverpaidEndedAndDeletedOnes()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { Total = 1000.00m, Payments = [new SeedMoney(Day(11, 3), 400.00m)] });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Delivered) { Total = 500.00m });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending) { Total = 250.00m, DueDate = new DateOnly(2026, 10, 1) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0004", OrderStatus.Mockup) { Total = 300.00m, Payments = [new SeedMoney(Day(11, 3), 350.00m)] });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0005", OrderStatus.Completed) { Total = 900.00m });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0006", OrderStatus.Cancelled) { Total = 800.00m });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0007", OrderStatus.Pending) { Total = 700.00m, Deleted = true });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0008", OrderStatus.Pending) { Total = 0.01m });

        var figures = await rig.ReadAsync();

        figures.Receivables.ShouldBe(1350.01m);
    }

    [Fact]
    public async Task CollectedIsPaymentsMinusRefundsInTheBusinessMonthWithCancelledOrdersInAndDeletedOnesOut()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments =
            [
                new SeedMoney(Day(11, 1), 700.00m),
                new SeedMoney(Day(11, 4), 300.00m),
                new SeedMoney(new DateOnly(2026, 10, 2), 400.00m),
                new SeedMoney(new DateOnly(2026, 10, 5), 999.00m),
                new SeedMoney(new DateOnly(2026, 10, 31), 111.00m),
            ],
            Refunds = [new SeedMoney(new DateOnly(2026, 10, 3), 50.00m)],
        });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Cancelled)
        {
            Total = 500.00m,
            Payments = [new SeedMoney(Day(11, 4), 200.00m)],
            Refunds = [new SeedMoney(Day(11, 3), 150.00m)],
        });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(Day(11, 2), 5000.00m)],
            Refunds = [new SeedMoney(Day(11, 2), 4000.00m)],
            Deleted = true,
        });

        var figures = await rig.ReadAsync();

        figures.CollectedThisMonth.ShouldBe(1050.00m);
        figures.CollectedComparison.ShouldBe(350.00m);
    }

    [Fact]
    public async Task CollectedMayBeBelowZeroAndKeepsEveryCentExactly()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Cancelled)
        {
            Total = 1000.00m,
            Payments = [new SeedMoney(Day(11, 1), 0.01m), new SeedMoney(new DateOnly(2026, 10, 1), 0.03m)],
            Refunds = [new SeedMoney(Day(11, 2), 300.00m), new SeedMoney(new DateOnly(2026, 10, 4), 0.01m)],
        });

        var figures = await rig.ReadAsync();

        figures.CollectedThisMonth.ShouldBe(-299.99m);
        figures.CollectedComparison.ShouldBe(0.02m);
    }

    [Fact]
    public async Task CollectedComparisonRunsFebruaryFirstToFebruaryTwentyEighthOnMarchThirtyFirst()
    {
        var rig = await Rig.StartAsync(database, MarchThirtyFirst);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 1000.00m,
            Payments =
            [
                new SeedMoney(new DateOnly(2026, 1, 31), 7.00m),
                new SeedMoney(new DateOnly(2026, 2, 1), 50.00m),
                new SeedMoney(new DateOnly(2026, 2, 28), 100.00m),
                new SeedMoney(new DateOnly(2026, 3, 1), 10.00m),
                new SeedMoney(new DateOnly(2026, 3, 31), 5.00m),
            ],
        });

        var figures = await rig.ReadAsync();

        rig.Period.ComparisonLast.ShouldBe(new DateOnly(2026, 2, 28));
        figures.CollectedComparison.ShouldBe(150.00m);
        figures.CollectedThisMonth.ShouldBe(15.00m);
    }

    [Fact]
    public async Task TheCallersFirstNameIsReadAndAnUnknownCallerGetsNone()
    {
        var rig = await Rig.StartAsync(database, Wednesday);

        var known = await rig.ReadAsync();
        var unknown = await rig.ReadAsync(Guid.NewGuid());

        known.FirstName.ShouldBe("Mina");
        unknown.FirstName.ShouldBeNull();
    }

    [Fact]
    public async Task TheReaderRunsExactlyFourCommandsWhateverTheData()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { Payments = [new SeedMoney(Day(11, 3), 100.00m)], Refunds = [new SeedMoney(Day(11, 3), 10.00m)] });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Completed));
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var figures = await new DashboardReader(context).GetSummaryAsync(rig.StaffId, rig.Period, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(4, string.Join(Environment.NewLine, counter.Commands));
        figures.CollectedThisMonth.ShouldBe(90.00m);
    }

    [Fact]
    public async Task AnEmptyShopGivesZeroEverywhere()
    {
        var rig = await Rig.StartAsync(database, Wednesday);

        var figures = await rig.ReadAsync();

        figures.ActiveOrders.ShouldBe(0);
        figures.DueThisWeek.ShouldBe(0);
        figures.Overdue.ShouldBe(0);
        figures.Receivables.ShouldBe(0m);
        figures.CollectedThisMonth.ShouldBe(0m);
        figures.CollectedComparison.ShouldBe(0m);
    }

    [Fact]
    public async Task StatusesCountCurrentOrdersPerStatusAndCompletedOnlyInTheBusinessMonthByUtcRange()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Pending));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Mockup));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0004", OrderStatus.InProduction));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0005", OrderStatus.InProduction));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0006", OrderStatus.InProduction));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0007", OrderStatus.Ready));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0008", OrderStatus.Delivered));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0009", OrderStatus.Delivered));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0010", OrderStatus.Cancelled));
        await rig.SeedAsync(new SeedOrder("ORD-2026-0011", OrderStatus.Pending) { Deleted = true });

        // 00:30 on Nov 1 in the business zone is 16:30 UTC the day before: inside this month.
        await rig.SeedAsync(new SeedOrder("ORD-2026-0012", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 10, 31, 16, 30, 0, TimeSpan.Zero) });

        // The month starts at exactly 16:00 UTC on Oct 31 and ends before the same hour on Nov 30.
        await rig.SeedAsync(new SeedOrder("ORD-2026-0013", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 10, 31, 16, 0, 0, TimeSpan.Zero) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0014", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 10, 31, 15, 59, 59, TimeSpan.Zero) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0015", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 10, 31, 2, 0, 0, TimeSpan.Zero) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0016", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 11, 30, 16, 0, 0, TimeSpan.Zero) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0017", OrderStatus.Completed) { StatusChangedAtUtc = new DateTimeOffset(2026, 11, 3, 12, 0, 0, TimeSpan.Zero), Deleted = true });

        var figures = await rig.ReadAsync();

        figures.Statuses.ShouldBe(new DashboardStatusCounts(Pending: 2, Mockup: 1, Production: 3, Ready: 1, Delivered: 2, CompletedThisMonth: 2));
    }

    [Fact]
    public async Task TheNewestOrdersAreTheSixLatestCreatedOfAnyStatusNewestFirstAndLeaveOutDeletedOnes()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        var created = new DateTimeOffset(2026, 11, 1, 3, 0, 0, TimeSpan.Zero);
        var ids = new List<Guid>();
        var statuses = new[] { OrderStatus.Pending, OrderStatus.Completed, OrderStatus.Cancelled, OrderStatus.Delivered, OrderStatus.Ready, OrderStatus.Mockup, OrderStatus.InProduction, OrderStatus.Pending };
        for (var index = 0; index < 8; index++)
        {
            ids.Add(await rig.SeedAsync(new SeedOrder($"ORD-2026-{index + 1:D4}", statuses[index]) { CreatedAtUtc = created.AddMinutes(index) }));
        }

        await rig.SeedAsync(new SeedOrder("ORD-2026-0099", OrderStatus.Pending) { CreatedAtUtc = created.AddMinutes(30), Deleted = true });

        var rows = await rig.ListNewestAsync(6);

        rows.Select(row => row.Id).ShouldBe([ids[7], ids[6], ids[5], ids[4], ids[3], ids[2]]);
        rows.Select(row => row.Status).ShouldBe([OrderStatus.Pending, OrderStatus.InProduction, OrderStatus.Mockup, OrderStatus.Ready, OrderStatus.Delivered, OrderStatus.Cancelled]);
    }

    [Fact]
    public async Task TheNewestOrdersListEveryOrderWhenThereAreFewerThanAsked()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        var created = new DateTimeOffset(2026, 11, 1, 3, 0, 0, TimeSpan.Zero);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { CreatedAtUtc = created });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Completed) { CreatedAtUtc = created.AddMinutes(1) });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Cancelled) { CreatedAtUtc = created.AddMinutes(2) });

        var rows = await rig.ListNewestAsync(6);

        rows.Select(row => row.Number).ShouldBe(["ORD-2026-0003", "ORD-2026-0002", "ORD-2026-0001"]);
    }

    [Fact]
    public async Task TheNewestOrdersBreakACreationTieByIdDescending()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        var created = new DateTimeOffset(2026, 11, 1, 3, 0, 0, TimeSpan.Zero);
        var first = await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending) { CreatedAtUtc = created });
        var second = await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Pending) { CreatedAtUtc = created });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0003", OrderStatus.Pending) { CreatedAtUtc = created.AddMinutes(-5) });

        var rows = await rig.ListNewestAsync(2);

        // The database orders ids its own way, so the expected pair is asked of the database with the same sort.
        var expected = await rig.IdsByDescendingIdAsync([first, second]);
        rows.Select(row => row.Id).ShouldBe(expected);
    }

    [Fact]
    public async Task MonthSumsGroupEachSourceByItsOwnDateAndKeepCancelledOrders()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(Day(6, 5), 100.00m), new SeedMoney(Day(10, 10), 1000.00m), new SeedMoney(Day(11, 2), 500.00m)],
            Refunds = [new SeedMoney(Day(11, 3), 200.00m)],
            Expenses = [new SeedMoney(Day(10, 3), 40.00m), new SeedMoney(Day(11, 1), 100.00m)],
        });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Cancelled)
        {
            Total = 800.00m,
            Payments = [new SeedMoney(Day(10, 20), 50.00m)],
            Refunds = [new SeedMoney(Day(10, 22), 10.00m)],
            Expenses = [new SeedMoney(Day(10, 21), 5.00m)],
        });
        await rig.SeedCompanyExpenseAsync(Day(10, 12), 300.00m);
        await rig.SeedCompanyExpenseAsync(Day(10, 13), 200.00m);
        await rig.SeedCompanyExpenseAsync(Day(11, 25), 80.00m);

        var sums = await rig.ReadMonthSumsAsync(Day(6, 1), Day(11, 30));

        Totals(sums.Payments).ShouldBe([(2026, 6, 100.00m), (2026, 10, 1050.00m), (2026, 11, 500.00m)]);
        Totals(sums.Refunds).ShouldBe([(2026, 10, 10.00m), (2026, 11, 200.00m)]);
        Totals(sums.CompanyExpenses).ShouldBe([(2026, 10, 500.00m), (2026, 11, 80.00m)]);
        Totals(sums.OrderExpenses).ShouldBe([(2026, 10, 45.00m), (2026, 11, 100.00m)]);
    }

    [Fact]
    public async Task MonthSumsLeaveOutDeletedOrdersAndDeletedCompanyExpenses()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments = [new SeedMoney(Day(11, 2), 5000.00m)],
            Refunds = [new SeedMoney(Day(11, 2), 4000.00m)],
            Expenses = [new SeedMoney(Day(11, 2), 900.00m)],
            Deleted = true,
        });
        await rig.SeedAsync(new SeedOrder("ORD-2026-0002", OrderStatus.Pending) { Payments = [new SeedMoney(Day(11, 2), 7.00m)] });
        await rig.SeedCompanyExpenseAsync(Day(11, 3), 600.00m, deleted: true);
        await rig.SeedCompanyExpenseAsync(Day(11, 3), 3.00m);

        var sums = await rig.ReadMonthSumsAsync(Day(6, 1), Day(11, 30));

        Totals(sums.Payments).ShouldBe([(2026, 11, 7.00m)]);
        sums.Refunds.ShouldBeEmpty();
        Totals(sums.CompanyExpenses).ShouldBe([(2026, 11, 3.00m)]);
        sums.OrderExpenses.ShouldBeEmpty();
    }

    [Fact]
    public async Task MonthSumsIncludeBothWindowEdgesAndLeaveOutTheDaysAroundThem()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Total = 5000.00m,
            Payments =
            [
                new SeedMoney(new DateOnly(2026, 5, 31), 1.00m),
                new SeedMoney(Day(6, 1), 2.00m),
                new SeedMoney(Day(11, 30), 4.00m),
                new SeedMoney(new DateOnly(2026, 12, 1), 8.00m),
            ],
        });
        await rig.SeedCompanyExpenseAsync(Day(11, 25), 80.00m);
        await rig.SeedCompanyExpenseAsync(new DateOnly(2026, 12, 2), 90.00m);

        var sums = await rig.ReadMonthSumsAsync(Day(6, 1), Day(11, 30));

        Totals(sums.Payments).ShouldBe([(2026, 6, 2.00m), (2026, 11, 4.00m)]);
        Totals(sums.CompanyExpenses).ShouldBe([(2026, 11, 80.00m)]);
    }

    [Fact]
    public async Task MonthSumsKeepDecemberAndJanuaryApartAcrossAYearEnd()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2025-0001", OrderStatus.Pending)
        {
            OrderDate = new DateOnly(2025, 9, 1),
            Total = 5000.00m,
            Payments = [new SeedMoney(new DateOnly(2025, 12, 31), 10.00m), new SeedMoney(new DateOnly(2026, 1, 1), 20.00m), new SeedMoney(new DateOnly(2025, 1, 1), 99.00m)],
        });

        var sums = await rig.ReadMonthSumsAsync(new DateOnly(2025, 9, 1), new DateOnly(2026, 2, 28));

        Totals(sums.Payments).ShouldBe([(2025, 12, 10.00m), (2026, 1, 20.00m)]);
    }

    [Fact]
    public async Task MonthSumsRunExactlyFourCommandsWhateverTheData()
    {
        var rig = await Rig.StartAsync(database, Wednesday);
        await rig.SeedAsync(new SeedOrder("ORD-2026-0001", OrderStatus.Pending)
        {
            Payments = [new SeedMoney(Day(11, 3), 100.00m)],
            Refunds = [new SeedMoney(Day(11, 3), 10.00m)],
            Expenses = [new SeedMoney(Day(11, 3), 5.00m)],
        });
        await rig.SeedCompanyExpenseAsync(Day(11, 3), 3.00m);
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var sums = await new DashboardReader(context).GetMonthSumsAsync(Day(6, 1), Day(11, 30), TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(4, string.Join(Environment.NewLine, counter.Commands));
        Totals(sums.Payments).ShouldBe([(2026, 11, 100.00m)]);
    }

    [Fact]
    public async Task MonthSumsOfAnEmptyShopAreFourEmptyLists()
    {
        var rig = await Rig.StartAsync(database, Wednesday);

        var sums = await rig.ReadMonthSumsAsync(Day(6, 1), Day(11, 30));

        sums.Payments.ShouldBeEmpty();
        sums.Refunds.ShouldBeEmpty();
        sums.CompanyExpenses.ShouldBeEmpty();
        sums.OrderExpenses.ShouldBeEmpty();
    }

    private static DateOnly Day(int month, int day) => new(2026, month, day);

    private static List<(int Year, int Month, decimal Total)> Totals(IReadOnlyList<MonthSum> sums) =>
        [.. sums.OrderBy(sum => sum.Year).ThenBy(sum => sum.Month).Select(sum => (sum.Year, sum.Month, sum.Total))];

    private sealed class Rig
    {
        private readonly CspsDatabase _database;
        private readonly DateTimeOffset _now;
        private readonly Guid _staffId;

        private Rig(CspsDatabase database, DateTimeOffset now, Guid staffId, DashboardPeriod period)
        {
            _database = database;
            _now = now;
            _staffId = staffId;
            Period = period;
        }

        public DashboardPeriod Period { get; }

        public Guid StaffId => _staffId;

        public static async Task<Rig> StartAsync(CspsDatabase database, DateTimeOffset now)
        {
            await database.ResetAsync();
            var staffId = await OrderSeeding.AddStaffAsync(database, "Mina", now);
            var clock = await new FixedBusinessCalendar(now).GetClockAsync(TestContext.Current.CancellationToken);
            return new Rig(database, now, staffId, DashboardPeriod.From(clock));
        }

        public Task<Guid> SeedAsync(SeedOrder order) => OrderSeeding.AddAsync(_database, order, _staffId, _now);

        public async Task<IReadOnlyList<OrderListRow>> ListNewestAsync(int count)
        {
            await using var context = _database.CreateContext();
            return await new OrderReader(context, new FixedBusinessCalendar(_now), new TestingImageDelivery()).ListNewestAsync(count, TestContext.Current.CancellationToken);
        }

        public async Task<List<Guid>> IdsByDescendingIdAsync(IReadOnlyCollection<Guid> ids)
        {
            await using var context = _database.CreateContext();
            return await context.Orders.AsNoTracking()
                .Where(order => ids.Contains(order.Id))
                .OrderByDescending(order => order.Id)
                .Select(order => order.Id)
                .ToListAsync(TestContext.Current.CancellationToken);
        }

        public async Task SeedCompanyExpenseAsync(DateOnly date, decimal amount, bool deleted = false)
        {
            var categoryId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id;
            var expense = CompanyExpense.Create(date, categoryId, "Thread and needles", amount, _staffId, null, date, _now).Value;
            await using var context = _database.CreateContext();
            context.CompanyExpenses.Add(expense);
            var entry = context.Entry(expense);
            entry.Property(row => row.CreatedById).CurrentValue = _staffId;
            entry.Property(row => row.CreatedAtUtc).CurrentValue = _now;
            if (deleted)
            {
                entry.Property(row => row.DeletedAtUtc).CurrentValue = _now.AddMinutes(1);
                entry.Property(row => row.DeletedById).CurrentValue = _staffId;
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        public async Task<DashboardMonthSums> ReadMonthSumsAsync(DateOnly firstDay, DateOnly lastDay)
        {
            await using var context = _database.CreateContext();
            return await new DashboardReader(context).GetMonthSumsAsync(firstDay, lastDay, TestContext.Current.CancellationToken);
        }

        public Task<DashboardFigures> ReadAsync() => ReadAsync(_staffId);

        public async Task<DashboardFigures> ReadAsync(Guid callerId)
        {
            await using var context = _database.CreateContext();
            return await new DashboardReader(context).GetSummaryAsync(callerId, Period, TestContext.Current.CancellationToken);
        }
    }
}
