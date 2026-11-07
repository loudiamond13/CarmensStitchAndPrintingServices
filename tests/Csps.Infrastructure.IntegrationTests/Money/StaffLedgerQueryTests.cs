using System.Data.SqlTypes;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Money;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Money;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using CompanyExpenseRecord = Csps.Domain.Expenses.CompanyExpense;

namespace Csps.Infrastructure.IntegrationTests.Money;

/// <summary>MONEY-02: the staff ledger union pages one person's money rows newest first in one statement, against a real SQL Server.</summary>
public sealed class StaffLedgerQueryTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Payment = (int)LedgerEntryKind.PaymentReceived;
    private const int Refund = (int)LedgerEntryKind.RefundHandedBack;
    private const int CompanyExpense = (int)LedgerEntryKind.CompanyExpensePaid;
    private const int OrderExpense = (int)LedgerEntryKind.OrderExpensePaid;

    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid SuppliesId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id;

    private int _orderCounter;
    private int _recordedCounter;

    [Fact]
    public async Task APersonsPaymentsAndCompanyExpenseComeBackNewestFirstAndAnotherPersonsAreAbsent()
    {
        var (a, b) = await SeedTwoPeopleAsync();
        await using var context = database.CreateContext();

        var rows = await StaffLedgerQuery.PageAsync(StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, a.Id)), 1, 10, TestContext.Current.CancellationToken);

        rows.Select(row => row.Kind).ShouldBe([(int)LedgerEntryKind.PaymentReceived, (int)LedgerEntryKind.CompanyExpensePaid, (int)LedgerEntryKind.PaymentReceived]);
        rows.Select(row => row.Date).ShouldBe([new DateOnly(2026, 10, 5), new DateOnly(2026, 10, 4), new DateOnly(2026, 10, 3)]);
        rows.Select(row => row.Signed).ShouldBe([250.50m, -120.25m, 500.00m]);
        rows.Select(row => row.SourceId).ShouldBe([a.LatePaymentId, a.ExpenseId, a.EarlyPaymentId]);
        rows.Select(row => row.SourceId).ShouldNotContain(b.PaymentId);
    }

    [Fact]
    public async Task APageReadRunsOneStatementThatIsAUnionAll()
    {
        var (a, _) = await SeedTwoPeopleAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var rows = await StaffLedgerQuery.PageAsync(StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, a.Id)), 1, 10, TestContext.Current.CancellationToken);

        rows.Count.ShouldBe(3);
        counter.Count.ShouldBe(1);
        counter.Commands.Single().ShouldContain("UNION ALL");
    }

    [Fact]
    public async Task RefundsAndOrderExpensesJoinTheUnionWithNegativeSigns()
    {
        await database.ResetAsync();
        var person = await NewPersonAsync("Ana");
        var seeded = await AddRowsAsync(
            person.Id,
            new Spec(Payment, new DateOnly(2026, 10, 3), 500.00m),
            new Spec(Refund, new DateOnly(2026, 10, 4), 60.00m),
            new Spec(OrderExpense, new DateOnly(2026, 10, 6), 30.75m));
        await using var context = database.CreateContext();

        var rows = await ReadAllAsync(context, person.Id);

        rows.Select(row => row.Kind).ShouldBe([OrderExpense, Refund, Payment]);
        rows.Select(row => row.Signed).ShouldBe([-30.75m, -60.00m, 500.00m]);
        rows.Select(row => row.SourceId).ShouldBe(seeded.OrderByDescending(row => row.Date).Select(row => row.Id));
        rows.ShouldAllBe(row => !row.Deleted);
    }

    [Fact]
    public async Task ADeletedOrderTakesItsPaymentRefundAndExpenseOutOfTheLedger()
    {
        await database.ResetAsync();
        var person = await NewPersonAsync("Ana");
        var day = new DateOnly(2026, 10, 5);
        await AddRowsAsync(
            person.Id,
            new Spec(Payment, day, 300.00m, Deleted: true),
            new Spec(Refund, day, 40.00m, Deleted: true),
            new Spec(OrderExpense, day, 25.00m, Deleted: true));
        var live = await AddRowsAsync(person.Id, new Spec(Payment, new DateOnly(2026, 10, 3), 500.00m));
        await using var context = database.CreateContext();

        var rows = await ReadAllAsync(context, person.Id);

        rows.Select(row => row.SourceId).ShouldBe(live.Select(row => row.Id));
    }

    [Fact]
    public async Task ADeletedExpenseIsNotInTheLedger()
    {
        await database.ResetAsync();
        var person = await NewPersonAsync("Ana");
        await AddRowsAsync(person.Id, new Spec(CompanyExpense, new DateOnly(2026, 10, 4), 120.25m, Deleted: true));
        var live = await AddRowsAsync(person.Id, new Spec(CompanyExpense, new DateOnly(2026, 10, 2), 80.00m));
        await using var context = database.CreateContext();

        var rows = await ReadAllAsync(context, person.Id);

        rows.Select(row => row.SourceId).ShouldBe(live.Select(row => row.Id));
    }

    [Fact]
    public async Task PagesFollowTheOrderWithNoGapAndNoRepeat()
    {
        var (person, expected) = await SeedTwentyFiveRowsAsync();
        await using var context = database.CreateContext();
        var ordered = StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, person.Id));

        var first = await StaffLedgerQuery.PageAsync(ordered, 1, 10, TestContext.Current.CancellationToken);
        var second = await StaffLedgerQuery.PageAsync(ordered, 2, 10, TestContext.Current.CancellationToken);
        var third = await StaffLedgerQuery.PageAsync(ordered, 3, 10, TestContext.Current.CancellationToken);
        var total = await StaffLedgerQuery.CountAsync(StaffLedgerQuery.For(context, person.Id), TestContext.Current.CancellationToken);

        first.Select(row => row.SourceId).ShouldBe(expected.Take(10).Select(row => row.Id));
        second.Select(row => row.SourceId).ShouldBe(expected.Skip(10).Take(10).Select(row => row.Id));
        third.Select(row => row.SourceId).ShouldBe(expected.Skip(20).Select(row => row.Id));
        third.Count.ShouldBe(5);
        total.ShouldBe(25);
    }

    [Theory]
    [InlineData(10)]
    [InlineData(100)]
    public async Task APageOfAnySizeRunsTheSameNumberOfCommands(int pageSize)
    {
        var (person, _) = await SeedTwentyFiveRowsAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var rows = await StaffLedgerQuery.PageAsync(StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, person.Id)), 1, pageSize, TestContext.Current.CancellationToken);

        counter.Count.ShouldBe(1);
        rows.Count.ShouldBe(Math.Min(pageSize, 25));
    }

    [Fact]
    public async Task SumNewerIsTheSumOfTheSignedRowsBeforeThePageAndZeroForNone()
    {
        var (person, expected) = await SeedTwentyFiveRowsAsync();
        await using var context = database.CreateContext();
        var ordered = StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, person.Id));

        var none = await StaffLedgerQuery.SumNewerAsync(ordered, 0, TestContext.Current.CancellationToken);
        var beforePageTwo = await StaffLedgerQuery.SumNewerAsync(ordered, 10, TestContext.Current.CancellationToken);
        var beforePageThree = await StaffLedgerQuery.SumNewerAsync(ordered, 20, TestContext.Current.CancellationToken);

        none.ShouldBe(0.00m);
        beforePageTwo.ShouldBe(expected.Take(10).Sum(row => row.Signed));
        beforePageThree.ShouldBe(expected.Take(20).Sum(row => row.Signed));
        beforePageTwo.ShouldNotBe(0m);
    }

    [Fact]
    public async Task SumNewerRunsOneStatementThatSumsInTheDatabase()
    {
        var (person, expected) = await SeedTwentyFiveRowsAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var ordered = StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, person.Id));

        counter.Reset();
        var sum = await StaffLedgerQuery.SumNewerAsync(ordered, 10, TestContext.Current.CancellationToken);

        sum.ShouldBe(expected.Take(10).Sum(row => row.Signed));
        counter.Count.ShouldBe(1);
        counter.Commands.Single().ShouldContain("SUM(");
    }

    [Fact]
    public async Task APersonWithNoRowsHasAnEmptyLedgerAndAZeroSumNewer()
    {
        var (person, _) = await SeedTwentyFiveRowsAsync();
        var nobody = await NewPersonAsync("Cora");
        await using var context = database.CreateContext();
        var ordered = StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, nobody.Id));

        var rows = await StaffLedgerQuery.PageAsync(ordered, 1, 10, TestContext.Current.CancellationToken);
        var sum = await StaffLedgerQuery.SumNewerAsync(ordered, 10, TestContext.Current.CancellationToken);

        rows.ShouldBeEmpty();
        sum.ShouldBe(0.00m);
        person.Id.ShouldNotBe(nobody.Id);
    }

    [Fact]
    public async Task RowsOnTheSameDayOrderByRecordedTimeThenKindThenIdAndPagesStayWhole()
    {
        await database.ResetAsync();
        var person = await NewPersonAsync("Ana");
        var day = new DateOnly(2026, 10, 5);
        var same = Now.AddMinutes(5);
        var seeded = await AddRowsAsync(
            person.Id,
            new Spec(Payment, day, 100.00m, Now.AddMinutes(10)),
            new Spec(Payment, day, 110.00m, same),
            new Spec(Payment, day, 120.00m, same),
            new Spec(Payment, day, 130.00m, same),
            new Spec(Refund, day, 10.00m, same),
            new Spec(OrderExpense, day, 20.00m, same),
            new Spec(CompanyExpense, day, 30.00m, same),
            new Spec(Payment, day, 140.00m, Now.AddMinutes(1)));
        var expected = InExpectedOrder(seeded);
        await using var context = database.CreateContext();
        var ordered = StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, person.Id));

        var all = await ReadAllAsync(context, person.Id);
        var again = await ReadAllAsync(context, person.Id);
        var paged = new List<StaffLedgerRow>();
        for (var page = 1; page <= 4; page++)
        {
            paged.AddRange(await StaffLedgerQuery.PageAsync(ordered, page, 2, TestContext.Current.CancellationToken));
        }

        all.Select(row => row.SourceId).ShouldBe(expected.Select(row => row.Id));
        again.Select(row => row.SourceId).ShouldBe(all.Select(row => row.SourceId));
        paged.Select(row => row.SourceId).ShouldBe(all.Select(row => row.SourceId));
        all.Select(row => row.Kind).ShouldBe(expected.Select(row => row.Kind));
        all[0].Signed.ShouldBe(100.00m);
        all[^1].Signed.ShouldBe(140.00m);
        all.Skip(1).Take(3).Select(row => row.Kind).ShouldAllBe(kind => kind == Payment);
        all.Skip(4).Take(3).Select(row => row.Kind).ShouldBe([Refund, CompanyExpense, OrderExpense]);
    }

    private async Task<(Person A, Person B)> SeedTwoPeopleAsync()
    {
        await database.ResetAsync();
        var a = await NewPersonAsync("Ana");
        var b = await NewPersonAsync("Ben");
        await using var context = database.CreateContext();

        var order = NewOrder(a.Id);
        var early = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 3), 500.00m, OrderListSeed.PaymentMethods[0].Id, null, null, a.Id), Today, Now).Value;
        var late = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 5), 250.50m, OrderListSeed.PaymentMethods[0].Id, null, null, a.Id), Today, Now).Value;
        var other = order.AddPayment(new NewOrderPayment(new DateOnly(2026, 10, 5), 90.00m, OrderListSeed.PaymentMethods[0].Id, null, null, b.Id), Today, Now).Value;
        context.Orders.Add(order);
        Stamp(context, early, Now.AddMinutes(1));
        Stamp(context, late, Now.AddMinutes(2));
        Stamp(context, other, Now.AddMinutes(3));

        var expense = CompanyExpenseRecord.Create(new DateOnly(2026, 10, 4), SuppliesId, "Thread", 120.25m, a.Id, null, Today, Now).Value;
        context.CompanyExpenses.Add(expense);
        Stamp(context, expense, Now.AddMinutes(4));

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (a with { EarlyPaymentId = early.Id, LatePaymentId = late.Id, ExpenseId = expense.Id }, b with { PaymentId = other.Id });
    }

    // 25 rows on 25 different days (1 to 25 October): 10 payments, 5 refunds, 5 order expenses and 5 company expenses.
    private async Task<(Person Person, IReadOnlyList<Seeded> NewestFirst)> SeedTwentyFiveRowsAsync()
    {
        await database.ResetAsync();
        var person = await NewPersonAsync("Ana");
        var kinds = new[] { Payment, Refund, Payment, OrderExpense, CompanyExpense };
        var specs = Enumerable.Range(0, 25)
            .Select(index => new Spec(kinds[index % 5], new DateOnly(2026, 10, 1).AddDays(index), 100.00m + (index * 1.25m)))
            .ToArray();
        var seeded = await AddRowsAsync(person.Id, specs);
        return (person, InExpectedOrder(seeded));
    }

    // The ledger order: date, then recorded time (both newest first), then kind, then source id as SQL Server compares uniqueidentifiers.
    private static List<Seeded> InExpectedOrder(IEnumerable<Seeded> rows) =>
        [.. rows.OrderByDescending(row => row.Date).ThenByDescending(row => row.Recorded).ThenBy(row => row.Kind).ThenBy(row => new SqlGuid(row.Id))];

    private static async Task<IReadOnlyList<StaffLedgerRow>> ReadAllAsync(CspsDbContext context, Guid userId) =>
        await StaffLedgerQuery.PageAsync(StaffLedgerQuery.Ordered(StaffLedgerQuery.For(context, userId)), 1, 100, TestContext.Current.CancellationToken);

    // Puts the specs into the database for one person: payments, refunds and order expenses on one live order (or one deleted order
    // when the spec says so), company expenses on their own. A refund is allowed only on a cancelled order, so payments and expenses go first, then the order is cancelled.
    private async Task<List<Seeded>> AddRowsAsync(Guid userId, params Spec[] specs)
    {
        await using var context = database.CreateContext();
        var seeded = new List<Seeded>();
        var liveOrder = NewOrder(userId);
        var deletedOrder = NewOrder(userId);
        var usedOrders = new HashSet<Order>();
        var cancelled = new HashSet<Order>();
        var pending = new List<(IAttributedRecord Record, DateTimeOffset Recorded)>();
        var methodId = OrderListSeed.PaymentMethods[0].Id;
        var categoryId = OrderListSeed.OrderExpenseCategories[0].Id;

        foreach (var spec in specs.OrderBy(spec => spec.Kind switch { Payment => 0, OrderExpense => 1, Refund => 2, _ => 3 }))
        {
            var recorded = spec.Recorded ?? Now.AddMinutes(++_recordedCounter);
            var order = spec.Deleted ? deletedOrder : liveOrder;
            switch (spec.Kind)
            {
                case Payment:
                    var payment = Ok(order.AddPayment(new NewOrderPayment(spec.Date, spec.Amount, methodId, null, null, userId), Today, Now));
                    usedOrders.Add(order);
                    seeded.Add(new Seeded(spec.Kind, payment.Id, spec.Date, spec.Amount, recorded, spec.Deleted));
                    pending.Add((payment, recorded));
                    break;
                case Refund:
                    if (cancelled.Add(order))
                    {
                        Ok(order.ChangeStatus(OrderStatus.Cancelled, userId, Now));
                    }

                    var refund = Ok(order.AddRefund(new NewOrderRefund(spec.Date, spec.Amount, "Changed their mind", userId), Today, Now));
                    usedOrders.Add(order);
                    seeded.Add(new Seeded(spec.Kind, refund.Id, spec.Date, -spec.Amount, recorded, spec.Deleted));
                    pending.Add((refund, recorded));
                    break;
                case OrderExpense:
                    var expense = Ok(order.AddExpense(new NewOrderExpense(spec.Date, spec.Amount, categoryId, null, userId), Today, Now));
                    usedOrders.Add(order);
                    seeded.Add(new Seeded(spec.Kind, expense.Id, spec.Date, -spec.Amount, recorded, spec.Deleted));
                    pending.Add((expense, recorded));
                    break;
                default:
                    var company = CompanyExpenseRecord.Create(spec.Date, SuppliesId, "Thread", spec.Amount, userId, null, Today, Now).Value;
                    if (spec.Deleted)
                    {
                        company.SoftDelete(userId, Now);
                    }

                    context.CompanyExpenses.Add(company);
                    Stamp(context, company, recorded);
                    seeded.Add(new Seeded(spec.Kind, company.Id, spec.Date, -spec.Amount, recorded, spec.Deleted));
                    break;
            }
        }

        if (usedOrders.Contains(deletedOrder))
        {
            deletedOrder.SoftDelete(userId, Now);
        }

        foreach (var order in usedOrders)
        {
            context.Orders.Add(order);
        }

        foreach (var (record, recorded) in pending)
        {
            Stamp(context, record, recorded);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        return [.. seeded.Where(row => !row.Deleted)];
    }

    // A seeding step that the domain refuses stops the test with the domain's own message.
    private static T Ok<T>(Result<T> result) =>
        result.IsSuccess
            ? result.Value
            : throw new InvalidOperationException($"{result.Error.Code}: {result.Error.Message} {string.Join("; ", (result.Error.FieldErrors ?? new Dictionary<string, string[]>()).Select(pair => $"{pair.Key}: {string.Join(", ", pair.Value)}"))}");

    private Order NewOrder(Guid callerId)
    {
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, Today, Today.AddDays(14), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 1, 100000.00m)]),
            callerId,
            Now).Value;
        order.AssignNumber($"ORD-2026-{++_orderCounter:D4}");
        return order;
    }

    // The test context has no stamp interceptor, so the recorded time is whatever the test sets.
    private static void Stamp(CspsDbContext context, IAttributedRecord record, DateTimeOffset recordedAtUtc) =>
        context.Entry(record).Property(nameof(IAttributedRecord.CreatedAtUtc)).CurrentValue = recordedAtUtc;

    private async Task<Person> NewPersonAsync(string firstName)
    {
        await using var context = database.CreateContext();
        var id = Guid.NewGuid();
        var email = $"ledger.{id:N}@example.com";
        context.Users.Add(new ApplicationUser
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = firstName,
            LastName = "Tester",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return new Person(id, Guid.Empty, Guid.Empty, Guid.Empty, Guid.Empty);
    }

    private sealed record Person(Guid Id, Guid EarlyPaymentId, Guid LatePaymentId, Guid ExpenseId, Guid PaymentId);

    private sealed record Spec(int Kind, DateOnly Date, decimal Amount, DateTimeOffset? Recorded = null, bool Deleted = false);

    private sealed record Seeded(int Kind, Guid Id, DateOnly Date, decimal Signed, DateTimeOffset Recorded, bool Deleted);
}
