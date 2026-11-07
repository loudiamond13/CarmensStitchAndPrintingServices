using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Money;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Money;
using Csps.Infrastructure.Persistence;
using Csps.Testing;

namespace Csps.Infrastructure.IntegrationTests.Money;

/// <summary>MONEY-02: the staff ledger union pages one person's money rows newest first in one statement, against a real SQL Server.</summary>
public sealed class StaffLedgerQueryTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly Guid SuppliesId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id;

    private int _orderCounter;

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

        var expense = CompanyExpense.Create(new DateOnly(2026, 10, 4), SuppliesId, "Thread", 120.25m, a.Id, null, Today, Now).Value;
        context.CompanyExpenses.Add(expense);
        Stamp(context, expense, Now.AddMinutes(4));

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (a with { EarlyPaymentId = early.Id, LatePaymentId = late.Id, ExpenseId = expense.Id }, b with { PaymentId = other.Id });
    }

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
}
