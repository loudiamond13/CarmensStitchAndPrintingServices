using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Microsoft.EntityFrameworkCore;

namespace Csps.Testing;

/// <summary>One payment or refund of a seeded order.</summary>
/// <param name="Date">The day the money moved.</param>
/// <param name="Amount">The amount in pesos.</param>
public sealed record SeedMoney(DateOnly Date, decimal Amount);

/// <summary>An order to write straight to a test database, with any status, dates and money the legacy import allows.</summary>
/// <param name="Number">The order number, such as <c>ORD-2026-0001</c>.</param>
/// <param name="Status">The status.</param>
public sealed record SeedOrder(string Number, OrderStatus Status)
{
    /// <summary>Gets the day the order was taken.</summary>
    public DateOnly OrderDate { get; init; } = new(2026, 10, 1);

    /// <summary>Gets the day the order is due; null for none.</summary>
    public DateOnly? DueDate { get; init; }

    /// <summary>Gets when the status last changed; null means the seeding instant.</summary>
    public DateTimeOffset? StatusChangedAtUtc { get; init; }

    /// <summary>Gets the order total: one line of one piece at this price.</summary>
    public decimal Total { get; init; } = 1000.00m;

    /// <summary>Gets the payments.</summary>
    public IReadOnlyList<SeedMoney> Payments { get; init; } = [];

    /// <summary>Gets the refunds.</summary>
    public IReadOnlyList<SeedMoney> Refunds { get; init; } = [];

    /// <summary>Gets when the order was created; null keeps the seeding instant.</summary>
    public DateTimeOffset? CreatedAtUtc { get; init; }

    /// <summary>Gets a value indicating whether the order is soft-deleted after it is written.</summary>
    public bool Deleted { get; init; }
}

/// <summary>Writes orders and staff straight to a test database for reader and endpoint tests.</summary>
public static class OrderSeeding
{
    /// <summary>Adds a user row with a first name, enough to be named on payments and refunds.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="firstName">The first name.</param>
    /// <param name="now">The creation instant.</param>
    /// <returns>The new user id.</returns>
    public static async Task<Guid> AddStaffAsync(CspsDatabase database, string firstName, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        var id = Guid.NewGuid();
        var email = $"staff.{id:N}@example.com";
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            context.Users.Add(new ApplicationUser
            {
                Id = id,
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = firstName,
                LastName = "Mercado",
                SecurityStamp = Guid.NewGuid().ToString("N"),
                CreatedAtUtc = now,
            });
            await context.SaveChangesAsync().ConfigureAwait(false);
        }

        return id;
    }

    /// <summary>Writes one order with the legacy import rules, then applies the delete mark and the creation instant.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="spec">The order to write.</param>
    /// <param name="staffId">The staff member named on each payment and refund.</param>
    /// <param name="now">The instant the order is written at.</param>
    /// <returns>The new order id.</returns>
    public static async Task<Guid> AddAsync(CspsDatabase database, SeedOrder spec, Guid staffId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(spec);
        var productTypeId = OrderListSeed.ProductTypes[0].Id;
        var cashId = OrderListSeed.PaymentMethods.Single(row => row.Name == "Cash").Id;
        var snapshot = new OrderImportSnapshot(
            spec.Number,
            new OrderDetails("Juan Dela Cruz", null, null, null, null, spec.OrderDate, spec.DueDate, null),
            spec.Status,
            [new NewOrderItem(productTypeId, "Jersey", null, 1, spec.Total)])
        {
            Payments = [.. spec.Payments.Select(payment => new NewOrderPayment(payment.Date, payment.Amount, cashId, null, null, staffId))],
            Refunds = [.. spec.Refunds.Select(refund => new NewOrderRefund(refund.Date, refund.Amount, "Seeded refund", staffId))],
            StatusHistory = spec.StatusChangedAtUtc is { } changedAt ? [new ImportedStatusChange(null, spec.Status, null, changedAt)] : [],
        };
        var order = Order.Import(snapshot, OrderImportRules.Default, now).Value;

        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            context.Orders.Add(order);
            await context.SaveChangesAsync().ConfigureAwait(false);
            if (spec.CreatedAtUtc is { } createdAt)
            {
                await context.Orders.Where(row => row.Id == order.Id)
                    .ExecuteUpdateAsync(set => set.SetProperty(row => row.CreatedAtUtc, createdAt)).ConfigureAwait(false);
            }

            if (spec.Deleted)
            {
                await context.Orders.Where(row => row.Id == order.Id)
                    .ExecuteUpdateAsync(set => set.SetProperty(row => row.DeletedAtUtc, now)).ConfigureAwait(false);
            }
        }

        return order.Id;
    }
}
