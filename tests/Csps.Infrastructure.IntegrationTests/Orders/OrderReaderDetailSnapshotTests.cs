using System.Data.Common;
using Csps.Application.Common;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Orders;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.Infrastructure.IntegrationTests.Orders;

/// <summary>
/// IWB-WR-04, ORD-03: the order detail is read in several statements, so a save that lands between them must not leave the header
/// and its version from one save and the lists from another. The row version is read again after the lists, as the order store does.
/// </summary>
public sealed class OrderReaderDetailSnapshotTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 28);
    private static readonly Guid JerseyId = OrderListSeed.ProductTypes.Single(row => row.Name == "Basketball Jersey").Id;

    [Fact]
    public async Task ASaveBetweenTheHeaderAndTheListsIsReadAgainSoTheAnswerIsOneSnapshot()
    {
        var id = await SeedAsync();
        var hook = new SaveDuringReadHook(database, id);
        await using var context = database.CreateContext(hook);

        var view = await new OrderReader(context, new FixedBusinessCalendar(Now)).GetDetailAsync(id, TestContext.Current.CancellationToken);

        hook.Fired.ShouldBeTrue();
        var detail = view.ShouldNotBeNull();
        detail.CustomerName.ShouldBe("Changed By Other");
        await using var fresh = database.CreateContext();
        var stored = await fresh.Orders.AsNoTracking().Where(row => row.Id == id).Select(row => row.RowVersion).SingleAsync(TestContext.Current.CancellationToken);
        detail.Version.ShouldBe(RowVersions.ToText(stored));
    }

    [Fact]
    public async Task AnOrderThatNobodyChangesIsReadOnceMoreOnlyToCheckItsVersion()
    {
        var id = await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);

        counter.Reset();
        var view = await new OrderReader(context, new FixedBusinessCalendar(Now)).GetDetailAsync(id, TestContext.Current.CancellationToken);

        view.ShouldNotBeNull().CustomerName.ShouldBe("Juan Dela Cruz");
        counter.Count.ShouldBe(8, string.Join(Environment.NewLine, counter.Commands));
    }

    [Fact]
    public async Task TheDetailCarriesTheBusinessTodayAndEachItemSaysWhoRecordedIt()
    {
        var id = await SeedAsync();
        await using var context = database.CreateContext();
        var staffId = await context.Users.Where(user => user.FirstName == "Mina").Select(user => user.Id).SingleAsync(TestContext.Current.CancellationToken);
        await context.Set<OrderItem>().Where(item => item.OrderId == id)
            .ExecuteUpdateAsync(set => set.SetProperty(item => item.CreatedById, (Guid?)staffId).SetProperty(item => item.CreatedAtUtc, Now), TestContext.Current.CancellationToken);
        var lateUtc = new DateTimeOffset(2026, 10, 28, 20, 0, 0, TimeSpan.Zero);

        var view = await new OrderReader(context, new FixedBusinessCalendar(lateUtc)).GetDetailAsync(id, TestContext.Current.CancellationToken);

        var detail = view.ShouldNotBeNull();
        detail.Today.ShouldBe(new DateOnly(2026, 10, 29));
        var item = detail.Items.ShouldHaveSingleItem();
        item.RecordedBy.ShouldNotBeNull().Name.ShouldBe("Mina Mercado");
        item.RecordedBy.FormerStaff.ShouldBeFalse();
        item.RecordedAt.ShouldBe(Now);
        item.LastChangedBy.ShouldBeNull();
        item.LastChangedAt.ShouldBeNull();
    }

    private async Task<Guid> SeedAsync()
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
            FirstName = "Mina",
            LastName = "Mercado",
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        var order = Order.Create(
            new NewOrder(new OrderDetails("Juan Dela Cruz", "Ballers", "0917 123 4567", null, null, Today, Today.AddDays(14), null), OrderStatus.Pending, [new NewOrderItem(JerseyId, "Jersey top", null, 2, 650.00m)]),
            callerId,
            Now).Value;
        order.AssignNumber("ORD-2026-0001");
        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return order.Id;
    }

    // Changes the order on another connection just before the first list is read, once.
    private sealed class SaveDuringReadHook(CspsDatabase database, Guid orderId) : DbCommandInterceptor
    {
        public bool Fired { get; private set; }

        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (!Fired && command.CommandText.Contains("[OrderItems]", StringComparison.Ordinal))
            {
                Fired = true;
                await using var other = database.CreateContext();
                await other.Orders
                    .Where(row => row.Id == orderId)
                    .ExecuteUpdateAsync(set => set.SetProperty(row => row.CustomerName, "Changed By Other"), cancellationToken);
            }

            return result;
        }
    }
}
