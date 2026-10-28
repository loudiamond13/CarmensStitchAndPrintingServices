using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>ORD-03, ORD-14, T-07-15, T-07-16: a number is given back by a rollback, and a busy lock is a polite error, never a crash.</summary>
public sealed class OrderNumberAllocatorTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Year = 2026;

    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ARolledBackCreateLeavesNoOrderNoAuditEntryAndNoCounterChangeAndTheNextCreateGetsTheSameNumber()
    {
        await database.ResetAsync();
        var callerId = await CreateUserAsync();
        await CreateOrderAsync(callerId, Guid.NewGuid().ToString("N"), failAfterSave: false);
        var committedCounter = await ReadLastValueAsync();
        committedCounter.ShouldBe(1);

        var correlation = Guid.NewGuid().ToString("N");
        var failed = await Should.ThrowAsync<InvalidOperationException>(() => CreateOrderAsync(callerId, correlation, failAfterSave: true));

        failed.Message.ShouldBe(Failure);
        await using var context = database.CreateContext();
        (await context.Orders.IgnoreQueryFilters().AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.AuditLog.AsNoTracking().CountAsync(entry => entry.CorrelationId == correlation, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await ReadLastValueAsync()).ShouldBe(committedCounter);

        var next = await CreateOrderAsync(callerId, Guid.NewGuid().ToString("N"), failAfterSave: false);

        next.ShouldBe("ORD-2026-0002");
        (await ReadLastValueAsync()).ShouldBe(2);
    }

    private const string Failure = "The save was undone on purpose.";

    // Allocates, adds an order and its audit entry, saves, and optionally throws before the commit.
    private async Task<string> CreateOrderAsync(Guid callerId, string correlation, bool failAfterSave)
    {
        await using var context = database.CreateContext();
        var allocator = new OrderNumberAllocator(context);
        var unitOfWork = new CspsUnitOfWork(context);
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]),
            callerId,
            Now).Value;

        return await unitOfWork.InTransactionAsync(
            async token =>
            {
                var number = await allocator.NextAsync(Year, Now, token);
                order.AssignNumber(number);
                context.Orders.Add(order);
                context.AuditLog.Add(AuditEntry.Create(Now, callerId, AuditActions.OrderCreated, "Order", order.Id.ToString("D"), null, null, correlation, number));
                await unitOfWork.SaveChangesAsync(token);
                return failAfterSave ? throw new InvalidOperationException(Failure) : number;
            },
            TestContext.Current.CancellationToken);
    }

    private async Task<int> ReadLastValueAsync()
    {
        await using var context = database.CreateContext();
        var counter = await context.OrderNumberCounters.AsNoTracking().SingleOrDefaultAsync(row => row.Year == Year, TestContext.Current.CancellationToken);
        return counter?.LastValue ?? 0;
    }

    private async Task<Guid> CreateUserAsync()
    {
        var id = Guid.NewGuid();
        var email = $"staff.{id:N}@example.com";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return id;
    }
}
