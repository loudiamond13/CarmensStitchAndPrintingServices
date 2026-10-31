using Csps.Domain.Common;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using DomainOrder = Csps.Domain.Orders.Order;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Adds the eight orders of UI spec section 12.2 to an empty Orders table (ORD-20), through <see cref="DomainOrder.Import"/> with
/// <see cref="OrderImportRules.Default"/>, so the numbers, statuses, dates and children stay as the spec gives them and every figure
/// is worked out again from the children. Receivers and payers alternate over the active staff who can pay (the same rule as the
/// company expenses step), or are the Legacy holder when there are none. The step never creates accounts or list entries, and it
/// lifts the year's number counter so the next new order is ORD-2026-0160. All text is made up and safe for a public repo.
/// </summary>
public sealed class OrdersSeedStep : ISeedStep
{
    private static readonly TimeSpan Manila = TimeSpan.FromHours(8);

    /// <inheritdoc />
    public int Order => 400;

    /// <inheritdoc />
    public string Name => "Orders";

    /// <inheritdoc />
    public async Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(time);

        if (await db.Orders.IgnoreQueryFilters(["SoftDelete"]).AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        var payers = await CompanyExpensesSeedStep.ReadPayersAsync(db, cancellationToken).ConfigureAwait(false);
        if (payers.Count == 0)
        {
            payers = [LegacyHolder.Id];
        }

        var now = time.GetUtcNow();
        var turn = 0;
        Guid NextPerson() => payers[turn++ % payers.Count];

        var highest = new Dictionary<int, int>();
        foreach (var row in Rows())
        {
            var snapshot = row.ToSnapshot(NextPerson);
            var imported = DomainOrder.Import(snapshot, OrderImportRules.Default, now);
            if (imported.IsFailure)
            {
                throw new InvalidOperationException($"The demo order {row.Number} broke a rule: {imported.Error.Message}");
            }

            db.Orders.Add(imported.Value);
            if (OrderNumber.TryParse(row.Number, out var year, out var sequence))
            {
                highest[year] = Math.Max(highest.GetValueOrDefault(year), sequence);
            }
        }

        // This context has no stamp interceptor, so the recorder and the time are set here.
        var recorder = payers[0] == LegacyHolder.Id ? (Guid?)null : payers[0];
        foreach (var entry in db.ChangeTracker.Entries<IAttributedRecord>().Where(entry => entry.State == EntityState.Added))
        {
            entry.Property(nameof(IAttributedRecord.CreatedById)).CurrentValue = recorder;
            entry.Property(nameof(IAttributedRecord.CreatedAtUtc)).CurrentValue = now;
        }

        foreach (var (year, sequence) in highest)
        {
            var counter = await db.OrderNumberCounters.SingleOrDefaultAsync(row => row.Year == year, cancellationToken).ConfigureAwait(false);
            if (counter is null)
            {
                counter = OrderNumberCounter.Start(year);
                db.OrderNumberCounters.Add(counter);
            }

            counter.EnsureAtLeast(sequence);
        }

        return true;
    }

    private static Guid Product(string name) => OrderListSeed.ProductTypes.Single(row => row.Name == name).Id;

    private static Guid Method(string name) => OrderListSeed.PaymentMethods.Single(row => row.Name == name).Id;

    private static Guid Category(string name) => OrderListSeed.OrderExpenseCategories.Single(row => row.Name == name).Id;

    private static DateOnly Day(int month, int day) => new(2026, month, day);

    private static DateTimeOffset NineInTheMorning(DateOnly day) =>
        new DateTimeOffset(day.Year, day.Month, day.Day, 9, 0, 0, Manila).ToUniversalTime();

    private static SeedLine Line(string product, string description, string? size, int quantity, decimal price) =>
        new(Product(product), description, size, quantity, price);

    private static SeedPayment Paid(DateOnly date, decimal amount, string method, string? reference = null, string? notes = null) =>
        new(date, amount, Method(method), reference, notes);

    private static SeedExpense Spent(DateOnly date, decimal amount, string category, string description) =>
        new(date, amount, Category(category), description);

    // UI spec section 12.2. Contact numbers, other than the first, are made up.
    private static IEnumerable<SeedOrder> Rows()
    {
        yield return new SeedOrder("ORD-2026-0148", "Brgy. San Roque Ballers", "Juan Dela Cruz", OrderStatus.InProduction, Day(9, 28), Day(10, 14))
        {
            Contact = "0917 123 4567",
            Email = "juan.dc@example.com",
            Address = "Brgy. San Roque, Marikina City",
            Notes = "V-neck, black and volt. Captain wants names in caps. Coach polos need embroidered logo.",
            Lines =
            [
                Line("Basketball Jersey", "Jersey top, sublimated, names & numbers", "S-XL", 15, 650.00m),
                Line("Basketball Jersey", "Shorts, matching colorway", "S-XL", 15, 300.00m),
                Line("Polo Shirt", "Coach polo, embroidered logo", "L", 2, 550.00m),
                Line("Long Sleeves", "Warm-up shooting shirt", "S-XL", 15, 420.00m),
                Line("Custom Design", "Team logo redraw & vector cleanup", null, 1, 800.00m),
            ],
            Discounts = [new NewOrderDiscount(DiscountKind.Percentage, 5m, "Barangay league discount")],
            Payments =
            [
                Paid(Day(9, 28), 10000.00m, "GCash", "9012 345 678901", "50% downpayment"),
                Paid(Day(10, 3), 2000.00m, "Cash", null, "For 2 added coach polos"),
            ],
            Expenses =
            [
                Spent(Day(10, 1), 3825.00m, "Fabric", "Dri-fit mesh, 45 yds"),
                Spent(Day(10, 2), 1640.00m, "Ink & paper", "Sublimation ink + transfer paper"),
                Spent(Day(10, 4), 600.00m, "Outsourcing", "Embroidery, coach polos"),
            ],
        };

        yield return new SeedOrder("ORD-2026-0151", "Tondo Riders MC", "Mark Villanueva", OrderStatus.Ready, Day(9, 30), Day(10, 10))
        {
            Contact = "0917 555 0151",
            Lines = [Line("Moto Riding Jersey", "Riding jersey, sublimated", "S-3XL", 20, 1150.00m)],
            Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 500m, "Club discount")],
            Payments = [Paid(Day(9, 30), 12000.00m, "GCash", null, "Downpayment"), Paid(Day(10, 8), 10500.00m, "Cash", null, "Balance")],
            Expenses = [Spent(Day(10, 2), 7200.00m, "Fabric", "Riding jersey fabric"), Spent(Day(10, 3), 2100.00m, "Ink & paper", "Ink and transfer paper")],
        };

        yield return new SeedOrder("ORD-2026-0153", null, "Angelica Santos", OrderStatus.Mockup, Day(10, 3), Day(10, 5))
        {
            Contact = "0917 555 0153",
            Lines = [Line("Volleyball Jersey", "Jersey, sublimated", "S-XL", 12, 780.00m)],
            Payments = [Paid(Day(10, 3), 3000.00m, "GCash", null, "Downpayment")],
        };

        yield return new SeedOrder("ORD-2026-0155", "Lady Spikers QC", "Kristine Mendoza", OrderStatus.Pending, Day(10, 5), Day(10, 24))
        {
            Contact = "0917 555 0155",
            Lines = [Line("Volleyball Jersey", "Jersey, sublimated", "S-XL", 14, 720.00m)],
        };

        yield return new SeedOrder("ORD-2026-0157", "St. Jude Parish Youth", "Liza Cruz", OrderStatus.InProduction, Day(10, 1), Day(10, 17))
        {
            Contact = "0917 555 0157",
            Lines = [Line("Basketball Jersey", "Youth jersey, sublimated", "XS-L", 40, 450.00m)],
            Payments = [Paid(Day(10, 1), 9000.00m, "Maya", null, "Downpayment")],
            Expenses = [Spent(Day(10, 6), 6400.00m, "Fabric", "Youth jersey fabric")],
        };

        yield return new SeedOrder("ORD-2026-0159", "Batangas Bikers Brotherhood", "Carlo Reyes", OrderStatus.Mockup, Day(10, 6), Day(10, 27))
        {
            Contact = "0917 555 0159",
            Lines = [Line("Moto Riding Jersey", "Riding jersey, sublimated", "S-3XL", 25, 1150.00m)],
            Payments = [Paid(Day(10, 6), 5000.00m, "Bank Transfer", null, "Downpayment")],
        };

        yield return new SeedOrder("ORD-2026-0142", "Marikina Moto Club", "Ramon Bautista", OrderStatus.Completed, Day(9, 12), Day(9, 30))
        {
            Contact = "0917 555 0142",
            Lines = [Line("Moto Riding Jersey", "Riding jersey, sublimated", "S-3XL", 30, 690.00m)],
            Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 1000m, "Returning club discount")],
            Payments = [Paid(Day(9, 12), 10000.00m, "GCash", null, "Downpayment"), Paid(Day(9, 29), 9700.00m, "Cash", null, "Balance")],
            Expenses = [Spent(Day(9, 15), 8900.00m, "Fabric", "Riding jersey fabric and ink")],
        };

        yield return new SeedOrder("ORD-2026-0139", "Kabataan Liga ng Pasig", "Jessa Ramos", OrderStatus.Cancelled, Day(9, 8), Day(9, 25))
        {
            Contact = "0917 555 0139",
            Lines = [Line("Basketball Jersey", "Jersey, sublimated", "S-XL", 10, 850.00m)],
        };
    }

    private sealed record SeedLine(Guid ProductTypeId, string Description, string? Size, int Quantity, decimal UnitPrice);

    private sealed record SeedPayment(DateOnly Date, decimal Amount, Guid MethodId, string? Reference, string? Notes);

    private sealed record SeedExpense(DateOnly Date, decimal Amount, Guid CategoryId, string Description);

    private sealed record SeedOrder(string Number, string? Team, string Customer, OrderStatus Status, DateOnly Ordered, DateOnly Due)
    {
        public string? Contact { get; init; }

        public string? Email { get; init; }

        public string? Address { get; init; }

        public string? Notes { get; init; }

        public IReadOnlyList<SeedLine> Lines { get; init; } = [];

        public IReadOnlyList<NewOrderDiscount> Discounts { get; init; } = [];

        public IReadOnlyList<SeedPayment> Payments { get; init; } = [];

        public IReadOnlyList<SeedExpense> Expenses { get; init; } = [];

        public OrderImportSnapshot ToSnapshot(Func<Guid> nextPerson) => new(
            Number,
            new OrderDetails(Customer, Team, Contact, Email, Address, Ordered, Due, Notes),
            Status,
            [.. Lines.Select(line => new NewOrderItem(line.ProductTypeId, line.Description, line.Size, line.Quantity, line.UnitPrice))])
        {
            Discounts = Discounts,
            Payments = [.. Payments.Select(pay => new NewOrderPayment(pay.Date, pay.Amount, pay.MethodId, pay.Reference, pay.Notes, nextPerson()))],
            Expenses = [.. Expenses.Select(cost => new NewOrderExpense(cost.Date, cost.Amount, cost.CategoryId, cost.Description, nextPerson()))],
            StatusHistory = [new ImportedStatusChange(null, Status, null, NineInTheMorning(Ordered))],
        };
    }
}
