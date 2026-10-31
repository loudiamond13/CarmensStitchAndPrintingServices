using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>
/// Builds about five years of fake orders for the speed check (PERF-04): 8 a day, one to four items each, payments on most and
/// expenses on many, six staff, 2% soft-deleted. It goes through the domain and EF <c>AddRange</c> in batches (no SQL strings) and a
/// seeded random, so every run is the same. It only ever writes through the <see cref="CspsDatabase"/> it is given, which is a
/// throwaway CSPS_Test database.
/// </summary>
internal static class OrderTimingData
{
    /// <summary>Orders made per day.</summary>
    public const int PerDay = 8;

    /// <summary>Days of history, ending on the business today.</summary>
    public const int Days = 1826;

    private const int BatchOrders = 250;
    private const uint RandomSeed = 20261028;
    private const int RecentDays = 60;

    private static readonly string[] StaffFirstNames = ["Alma", "Benito", "Carla", "Dante", "Elena", "Felix"];
    private static readonly string[] StaffLastNames = ["Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Bautista"];
    private static readonly string[] CustomerFirstNames = ["Juan", "Maria", "Pedro", "Ana", "Jose", "Rosa", "Mario", "Luz"];
    private static readonly string[] CustomerLastNames = ["Dela Cruz", "Santos", "Reyes", "Lopez", "Garcia", "Torres", "Ramos", "Aquino"];
    private static readonly string[] Teams = ["Ballers", "Riders Club", "Barangay League", "City Hawks", "Tricycle Association", "Night Owls"];
    private static readonly string[] Things = ["Jersey top", "Jersey shorts", "Coach polo", "Warm-up shirt", "Team banner", "Cycling jersey"];

    private static readonly OrderStatus[] RecentStatuses =
    [
        OrderStatus.Pending,
        OrderStatus.Mockup,
        OrderStatus.InProduction,
        OrderStatus.Ready,
        OrderStatus.Delivered,
        OrderStatus.Delivered,
        OrderStatus.Completed,
        OrderStatus.Cancelled,
    ];

    /// <summary>Writes the staff and the orders.</summary>
    /// <param name="database">The throwaway test database.</param>
    /// <param name="today">The business today; the last day of the history.</param>
    /// <param name="now">The real current instant, so recent status changes sit inside the list's 30 day window.</param>
    /// <returns>A customer first name that the search scenario looks for, and how many orders were written.</returns>
    public static async Task<TimingDataSummary> BuildAsync(CspsDatabase database, DateOnly today, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        var staff = await AddStaffAsync(database).ConfigureAwait(false);
        var productTypes = OrderListSeed.ProductTypes.Select(row => row.Id).ToArray();
        var methods = OrderListSeed.PaymentMethods.Select(row => row.Id).ToArray();
        var categories = OrderListSeed.OrderExpenseCategories.Select(row => row.Id).ToArray();
        var random = new Sequence(RandomSeed);
        var written = 0;

        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var pending = 0;
            for (var offset = Days - 1; offset >= 0; offset--)
            {
                var date = today.AddDays(-offset);
                for (var slot = 0; slot < PerDay; slot++)
                {
                    written++;
                    AddOrder(context, random, new Day(date, slot, offset, written), staff, new Lists(productTypes, methods, categories), today, now);
                    pending++;
                    if (pending == BatchOrders)
                    {
                        await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
                        context.ChangeTracker.Clear();
                        pending = 0;
                    }
                }
            }

            if (pending > 0)
            {
                await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
                context.ChangeTracker.Clear();
            }
        }

        return new TimingDataSummary(CustomerFirstNames[2], written);
    }

    private static void AddOrder(CspsDbContext context, Sequence random, Day day, Guid[] staff, Lists lists, DateOnly today, DateTimeOffset now)
    {
        var creator = staff[random.Next(staff.Length)];
        var created = new DateTimeOffset(day.Date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).AddHours(2).AddMinutes(day.Slot * 3);
        var status = day.Offset >= RecentDays
            ? (random.Next(10) < 9 ? OrderStatus.Completed : OrderStatus.Cancelled)
            : RecentStatuses[random.Next(RecentStatuses.Length)];

        var items = new List<NewOrderItem>();
        var subtotal = 0m;
        for (var index = random.Next(1, 5); index > 0; index--)
        {
            var quantity = random.Next(1, 21);
            var price = random.Next(2, 30) * 50m;
            subtotal += quantity * price;
            items.Add(new NewOrderItem(lists.ProductTypes[random.Next(lists.ProductTypes.Length)], Things[random.Next(Things.Length)], "S-XL", quantity, price));
        }

        var payments = new List<NewOrderPayment>();
        var share = status == OrderStatus.Completed ? 10 : random.Next(10);
        if (share >= 3)
        {
            var amount = share >= 8 ? subtotal : Math.Round(subtotal / 2m, 2);
            payments.Add(new NewOrderPayment(day.Date, amount, lists.Methods[random.Next(lists.Methods.Length)], null, null, staff[random.Next(staff.Length)]));
        }

        var expenses = new List<NewOrderExpense>();
        if (random.Next(10) < 6)
        {
            expenses.Add(new NewOrderExpense(day.Date, Math.Round(subtotal * 0.3m, 2), lists.Categories[random.Next(lists.Categories.Length)], null, staff[random.Next(staff.Length)]));
        }

        var customer = $"{CustomerFirstNames[random.Next(CustomerFirstNames.Length)]} {CustomerLastNames[random.Next(CustomerLastNames.Length)]}";
        var details = new OrderDetails(
            customer,
            Teams[random.Next(Teams.Length)],
            $"0917 {random.Next(100, 1000)} {random.Next(1000, 10000)}",
            null,
            null,
            day.Date,
            day.Date.AddDays(random.Next(7, 22)),
            null);
        var order = Order.Create(new NewOrder(details, OrderStatus.Pending, items) { Payments = payments, Expenses = expenses }, creator, created, today).Value;
        order.AssignNumber($"T{day.Number:D8}");
        context.Orders.Add(order);

        var entry = context.Entry(order);
        entry.Property(row => row.Status).CurrentValue = status;
        var changed = created.AddDays(random.Next(1, 20));
        entry.Property(row => row.StatusChangedAtUtc).CurrentValue = changed > now ? now : changed;
        entry.Property(row => row.CreatedById).CurrentValue = creator;
        entry.Property(row => row.CreatedAtUtc).CurrentValue = created;
        if (random.Next(100) < 2)
        {
            entry.Property(row => row.DeletedAtUtc).CurrentValue = created.AddMinutes(30);
            entry.Property(row => row.DeletedById).CurrentValue = creator;
        }
    }

    private static async Task<Guid[]> AddStaffAsync(CspsDatabase database)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var ids = new List<Guid>();
            for (var index = 0; index < StaffFirstNames.Length; index++)
            {
                var email = $"timing.{Guid.NewGuid():N}@example.com";
                var user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    NormalizedUserName = email.ToUpperInvariant(),
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    FirstName = StaffFirstNames[index],
                    LastName = StaffLastNames[index],
                };
                context.Users.Add(user);
                ids.Add(user.Id);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
            return [.. ids];
        }
    }

    private sealed record Day(DateOnly Date, int Slot, int Offset, int Number);

    private sealed record Lists(Guid[] ProductTypes, Guid[] Methods, Guid[] Categories);
}
