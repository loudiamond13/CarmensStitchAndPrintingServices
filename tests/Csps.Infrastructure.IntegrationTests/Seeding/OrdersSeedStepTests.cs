using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>ORD-20: the dev seed adds the eight UI-spec orders through the import path, with the exact figures and fictional text.</summary>
public sealed class OrdersSeedStepTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);

    private static readonly string[] Numbers =
    [
        "ORD-2026-0139", "ORD-2026-0142", "ORD-2026-0148", "ORD-2026-0151",
        "ORD-2026-0153", "ORD-2026-0155", "ORD-2026-0157", "ORD-2026-0159",
    ];

    [Fact]
    public async Task AddsTheEightUiSpecOrdersWithTheirNumbersAndStatuses()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);
        await AddUserAsync(Roles.Manager);

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeTrue();
        var orders = await ReadOrdersAsync();
        orders.Select(order => order.Number).Order().ShouldBe(Numbers);
        Statuses(orders).ShouldBe(
        [
            ("ORD-2026-0139", OrderStatus.Cancelled),
            ("ORD-2026-0142", OrderStatus.Completed),
            ("ORD-2026-0148", OrderStatus.InProduction),
            ("ORD-2026-0151", OrderStatus.Ready),
            ("ORD-2026-0153", OrderStatus.Mockup),
            ("ORD-2026-0155", OrderStatus.Pending),
            ("ORD-2026-0157", OrderStatus.InProduction),
            ("ORD-2026-0159", OrderStatus.Mockup),
        ]);
        orders.Single(order => order.Number == "ORD-2026-0153").TeamName.ShouldBeNull();
        orders.Single(order => order.Number == "ORD-2026-0153").DueDate.ShouldBe(new DateOnly(2026, 10, 5));
        orders.ShouldAllBe(order => order.StatusChanges.Count == 1 && order.StatusChanges.Single().ToStatus == order.Status);
    }

    [Fact]
    public async Task Ord0148ReadsEveryFigureExactly()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);

        await RunAsync();

        var order = (await ReadOrdersAsync()).Single(row => row.Number == "ORD-2026-0148");
        order.CustomerName.ShouldBe("Juan Dela Cruz");
        order.TeamName.ShouldBe("Brgy. San Roque Ballers");
        order.ContactNumber.ShouldBe("0917 123 4567");
        order.Email.ShouldBe("juan.dc@example.com");
        order.OrderDate.ShouldBe(new DateOnly(2026, 9, 28));
        order.DueDate.ShouldBe(new DateOnly(2026, 10, 14));
        order.Items.OrderBy(item => item.Position).Select(item => (item.Quantity, item.UnitPrice)).ShouldBe(
            [(15, 650.00m), (15, 300.00m), (2, 550.00m), (15, 420.00m), (1, 800.00m)]);
        var discount = order.Discounts.ShouldHaveSingleItem();
        discount.Kind.ShouldBe(DiscountKind.Percentage);
        discount.Value.ShouldBe(5m);
        discount.Reason.ShouldBe("Barangay league discount");
        order.Payments.OrderBy(payment => payment.Position).Select(payment => (payment.Amount, payment.PaymentMethodId)).ShouldBe(
            [(10000.00m, MethodId("GCash")), (2000.00m, MethodId("Cash"))]);
        order.Expenses.OrderBy(expense => expense.Position).Select(expense => expense.Amount).ShouldBe([3825.00m, 1640.00m, 600.00m]);
        order.Subtotal.ShouldBe(22450.00m);
        order.DiscountTotal.ShouldBe(1122.50m);
        order.Total.ShouldBe(21327.50m);
        order.PaidTotal.ShouldBe(12000.00m);
        order.Balance.ShouldBe(9327.50m);
        order.ExpensesTotal.ShouldBe(6065.00m);
        order.Profit.ShouldBe(15262.50m);
        order.FullyPaid.ShouldBeFalse();
    }

    [Fact]
    public async Task Ord0151IsFullyPaidWithNoBalance()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);

        await RunAsync();

        var orders = await ReadOrdersAsync();
        var paid = orders.Single(row => row.Number == "ORD-2026-0151");
        paid.Balance.ShouldBe(0.00m);
        paid.FullyPaid.ShouldBeTrue();
        paid.Total.ShouldBe(22500.00m);
        var completed = orders.Single(row => row.Number == "ORD-2026-0142");
        completed.Balance.ShouldBe(0.00m);
        completed.Total.ShouldBe(19700.00m);
        orders.ShouldAllBe(row => row.Balance >= 0m);
    }

    [Fact]
    public async Task ReceiversAndPayersAreTheActivePayersAndBothAreUsed()
    {
        await database.ResetAsync();
        var admin = await AddUserAsync(Roles.Admin);
        var manager = await AddUserAsync(Roles.Manager);
        await AddUserAsync(Roles.Admin, active: false);
        await AddUserAsync(Roles.Manager, passwordHash: null);

        await RunAsync();

        var orders = await ReadOrdersAsync();
        var received = orders.SelectMany(order => order.Payments).Select(payment => payment.ReceivedByUserId).Distinct().Order().ToList();
        var paid = orders.SelectMany(order => order.Expenses).Select(expense => expense.PaidByUserId).Distinct().Order().ToList();
        List<Guid> payers = [.. new[] { admin, manager }.Order()];
        received.ShouldBe(payers);
        paid.ShouldBe(payers);
    }

    [Fact]
    public async Task WithNoPayerAccountsTheLegacyHolderReceivesAndPaysAndNoAccountIsCreated()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Manager, passwordHash: null);

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeTrue();
        var orders = await ReadOrdersAsync();
        orders.Count.ShouldBe(8);
        orders.SelectMany(order => order.Payments).ShouldAllBe(payment => payment.ReceivedByUserId == LegacyHolder.Id);
        orders.SelectMany(order => order.Expenses).ShouldAllBe(expense => expense.PaidByUserId == LegacyHolder.Id);
        await using var context = database.CreateContext();
        (await context.Users.CountAsync(user => user.Id != LegacyHolder.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task TheCounterEndsAtOrAbove159SoTheNextOrderIsOrd0160()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);

        await RunAsync();

        await using var context = database.CreateContext();
        var counter = await context.OrderNumberCounters.AsNoTracking().SingleAsync(row => row.Year == 2026, TestContext.Current.CancellationToken);
        counter.LastValue.ShouldBeGreaterThanOrEqualTo(159);
        OrderNumber.Format(2026, counter.LastValue + 1).ShouldBe("ORD-2026-0160");
    }

    [Fact]
    public async Task ASecondRunAddsNothing()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);
        await RunAsync();

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeFalse();
        (await ReadOrdersAsync()).Count.ShouldBe(8);
        await using var context = database.CreateContext();
        (await context.OrderNumberCounters.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).LastValue.ShouldBe(159);
    }

    [Fact]
    public async Task EveryStoredRecordIsStampedWithTheSeedTime()
    {
        await database.ResetAsync();
        var admin = await AddUserAsync(Roles.Admin);

        await RunAsync();

        var orders = await ReadOrdersAsync();
        orders.Count.ShouldBe(8);
        orders.ShouldAllBe(order => order.CreatedAtUtc == Now && order.CreatedById == admin);
        orders.SelectMany(order => order.Items).ShouldAllBe(item => item.CreatedAtUtc == Now);
        orders.SelectMany(order => order.Payments).ShouldAllBe(payment => payment.CreatedAtUtc == Now);
        orders.SelectMany(order => order.Expenses).ShouldAllBe(expense => expense.CreatedAtUtc == Now);
    }

    [Fact]
    public async Task TheFixtureTextIsFictionalAndSafeForAPublicRepo()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Admin);

        await RunAsync();

        var orders = await ReadOrdersAsync();
        orders.Count.ShouldBe(8);
        orders.Where(order => order.Email is not null).ShouldAllBe(order => order.Email!.EndsWith("@example.com", StringComparison.Ordinal));
        orders.ShouldAllBe(order => order.Email == null || !order.Email.Contains("gmail", StringComparison.OrdinalIgnoreCase));
    }

    private static IEnumerable<(string Number, OrderStatus Status)> Statuses(List<Order> orders) =>
        orders.OrderBy(order => order.Number, StringComparer.Ordinal).Select(order => (order.Number, order.Status));

    private static Guid MethodId(string name) => OrderListSeed.PaymentMethods.Single(row => row.Name == name).Id;

    private async Task<IReadOnlyList<SeedStepResult>> RunAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await new DevSeeder([new OrdersSeedStep()], new FakeTimeProvider(Now))
                .RunAsync(context, TestContext.Current.CancellationToken);
        }
    }

    private async Task<List<Order>> ReadOrdersAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await context.Orders.AsNoTracking().AsSplitQuery()
                .Include(order => order.Items)
                .Include(order => order.Discounts)
                .Include(order => order.Payments)
                .Include(order => order.Expenses)
                .Include(order => order.StatusChanges)
                .ToListAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task<Guid> AddUserAsync(string role, string? passwordHash = "fake-hash", bool active = true)
    {
        var context = database.CreateContext();
        await using (context)
        {
            var email = $"seed.{Guid.NewGuid():N}@example.com";
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = "Paolo",
                LastName = "Reyes",
                PasswordHash = passwordHash,
                IsActive = active,
                EmailConfirmed = true,
            };
            context.Users.Add(user);
            var roleId = await context.Roles.Where(row => row.Name == role).Select(row => row.Id).SingleAsync(TestContext.Current.CancellationToken);
            context.UserRoles.Add(new IdentityUserRole<Guid> { UserId = user.Id, RoleId = roleId });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            return user.Id;
        }
    }
}
