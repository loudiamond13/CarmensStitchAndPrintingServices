using Csps.Application.Common;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>ORD-08, T-07-21: the order's row is locked before its children are written, and a writer that lost the race is told so with nothing written.</summary>
public sealed class OrderStoreLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ALockOnTheVersionThatWasLoadedKeepsTheFollowingSaveWorking()
    {
        var id = await CreateOrderAsync();
        await using var context = database.CreateContext();
        var store = new OrderStore(context);
        var unitOfWork = new CspsUnitOfWork(context);

        await unitOfWork.InTransactionAsync(
            async token =>
            {
                var order = (await store.FindAsync(id, includeDeleted: false, token))!;
                var loaded = order.RowVersion.ToArray();
                order.AddItem(new NewOrderItem(OrderListSeed.ProductTypes[1].Id, "Coach polo", "L", 2, 550.00m), Now.AddMinutes(1)).IsSuccess.ShouldBeTrue();

                await store.LockAsync(order, token);
                await unitOfWork.SaveChangesAsync(token);

                order.RowVersion.ShouldNotBe(loaded);
                return true;
            },
            TestContext.Current.CancellationToken);

        await using var check = database.CreateContext();
        var stored = await check.Orders.AsNoTracking().Include(order => order.Items).SingleAsync(order => order.Id == id, TestContext.Current.CancellationToken);
        stored.Items.Count.ShouldBe(2);
        stored.Subtotal.ShouldBe(1300.00m + 1100.00m);
    }

    [Fact]
    public async Task ALockAfterAnotherRequestChangedTheOrderThrowsTheConflictAndDropsTheTrackedState()
    {
        var id = await CreateOrderAsync();
        await using var context = database.CreateContext();
        var store = new OrderStore(context);
        var unitOfWork = new CspsUnitOfWork(context);
        await using var other = database.CreateContext();
        var otherStore = new OrderStore(other);

        await unitOfWork.InTransactionAsync(
            async token =>
            {
                var order = (await store.FindAsync(id, includeDeleted: false, token))!;
                var rival = (await otherStore.FindAsync(id, includeDeleted: false, token))!;
                rival.AddItem(new NewOrderItem(OrderListSeed.ProductTypes[2].Id, "Rival item", null, 1, 10.00m), Now.AddMinutes(1)).IsSuccess.ShouldBeTrue();
                await other.SaveChangesAsync(token);
                order.AddItem(new NewOrderItem(OrderListSeed.ProductTypes[1].Id, "Late item", null, 1, 20.00m), Now.AddMinutes(2)).IsSuccess.ShouldBeTrue();

                await Should.ThrowAsync<ConcurrencyConflictException>(() => store.LockAsync(order, token));

                context.ChangeTracker.Entries().ShouldBeEmpty();
                return true;
            },
            TestContext.Current.CancellationToken);

        await using var check = database.CreateContext();
        var stored = await check.Orders.AsNoTracking().Include(order => order.Items).SingleAsync(order => order.Id == id, TestContext.Current.CancellationToken);
        stored.Items.Select(static item => item.Description).Order(StringComparer.Ordinal).ShouldBe(["Jersey top", "Rival item"]);
    }

    private async Task<Guid> CreateOrderAsync()
    {
        await database.ResetAsync();
        var callerId = Guid.NewGuid();
        var email = $"staff.{callerId:N}@example.com";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = callerId,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]),
            callerId,
            Now).Value;
        order.AssignNumber("ORD-2026-0001");
        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return order.Id;
    }
}
