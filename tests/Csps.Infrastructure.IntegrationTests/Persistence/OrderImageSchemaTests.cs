using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// ORD-04, D-08, OR-7: the database itself refuses a sixth photo for one order without a trigger. Slot is limited to 0 to 4 and unique
/// per order, Position is limited to 0 to 4 and may repeat, and a public id is unique. Rows are written through a small test context
/// that maps the table directly, because the domain never lets a bad row be built.
/// </summary>
public sealed class OrderImageSchemaTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 28, 12, 0, 0, TimeSpan.Zero);

    private static long _orderNumber = 9000;

    [Fact]
    public async Task FivePhotosInSlotsZeroToFourAreAcceptedAndASixthIsRefusedInAnySlot()
    {
        var orderId = await InsertOrderAsync();
        for (var slot = 0; slot < 5; slot++)
        {
            await InsertImageAsync(orderId, slot, position: slot);
        }

        for (var slot = 0; slot <= 5; slot++)
        {
            var refused = await Should.ThrowAsync<DbUpdateException>(() => InsertImageAsync(orderId, slot, position: 0));

            Detail(refused).ShouldMatch("CK_OrderImages_Slot_Range|IX_OrderImages_OrderId_Slot");
        }

        (await CountAsync(orderId)).ShouldBe(5);
    }

    [Fact]
    public async Task ASlotOfFiveFailsTheRangeCheck()
    {
        var orderId = await InsertOrderAsync();

        var refused = await Should.ThrowAsync<DbUpdateException>(() => InsertImageAsync(orderId, slot: 5, position: 0));

        Detail(refused).ShouldContain("CK_OrderImages_Slot_Range");
    }

    [Fact]
    public async Task APositionOfFiveFailsTheRangeCheck()
    {
        var orderId = await InsertOrderAsync();

        var refused = await Should.ThrowAsync<DbUpdateException>(() => InsertImageAsync(orderId, slot: 0, position: 5));

        Detail(refused).ShouldContain("CK_OrderImages_Position_Range");
    }

    [Fact]
    public async Task TwoRowsWithTheSameOrderAndSlotFailTheUniqueIndex()
    {
        var orderId = await InsertOrderAsync();
        await InsertImageAsync(orderId, slot: 2, position: 0);

        var refused = await Should.ThrowAsync<DbUpdateException>(() => InsertImageAsync(orderId, slot: 2, position: 1));

        Detail(refused).ShouldContain("IX_OrderImages_OrderId_Slot");
        (await CountAsync(orderId)).ShouldBe(1);
    }

    [Fact]
    public async Task TheSameSlotOnTwoDifferentOrdersIsAccepted()
    {
        var first = await InsertOrderAsync();
        var second = await InsertOrderAsync();

        await InsertImageAsync(first, slot: 0, position: 0);
        await InsertImageAsync(second, slot: 0, position: 0);

        (await CountAsync(first)).ShouldBe(1);
        (await CountAsync(second)).ShouldBe(1);
    }

    [Fact]
    public async Task TwoRowsWithTheSamePositionForOneOrderAreAccepted()
    {
        var orderId = await InsertOrderAsync();

        await InsertImageAsync(orderId, slot: 0, position: 1);
        await InsertImageAsync(orderId, slot: 1, position: 1);

        (await CountAsync(orderId)).ShouldBe(2);
    }

    [Fact]
    public async Task ADuplicatePublicIdFailsTheUniqueIndex()
    {
        var orderId = await InsertOrderAsync();
        var publicId = "csps-test/orders/" + Guid.NewGuid().ToString("N");
        await InsertImageAsync(orderId, slot: 0, position: 0, publicId);

        var refused = await Should.ThrowAsync<DbUpdateException>(() => InsertImageAsync(orderId, slot: 1, position: 1, publicId));

        Detail(refused).ShouldContain("IX_OrderImages_PublicId");
    }

    private static string Detail(DbUpdateException error) => (error.InnerException as SqlException)?.Message ?? error.Message;

    // A saved order for the foreign key; its own domain code builds it, so the row is a real one.
    private async Task<Guid> InsertOrderAsync()
    {
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, new DateOnly(2026, 10, 28), new DateOnly(2026, 11, 11), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]),
            LegacyHolder.Id,
            Now).Value;
        order.AssignNumber($"ORD-2026-{Interlocked.Increment(ref _orderNumber):D4}");

        await using var context = database.CreateContext();
        context.Orders.Add(order);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return order.Id;
    }

    private async Task InsertImageAsync(Guid orderId, int slot, int position, string? publicId = null)
    {
        await using var context = new ImageRowContext(new DbContextOptionsBuilder<ImageRowContext>().UseSqlServer(database.ConnectionString).Options);
        context.Rows.Add(new ImageRow
        {
            Id = Guid.NewGuid(),
            OrderId = orderId,
            Slot = slot,
            Position = position,
            PublicId = publicId ?? "csps-test/orders/" + Guid.NewGuid().ToString("N"),
            Width = 640,
            Height = 480,
            Bytes = 1000,
            Format = "jpg",
            CreatedAtUtc = Now,
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountAsync(Guid orderId)
    {
        await using var context = new ImageRowContext(new DbContextOptionsBuilder<ImageRowContext>().UseSqlServer(database.ConnectionString).Options);
        return await context.Rows.CountAsync(row => row.OrderId == orderId, TestContext.Current.CancellationToken);
    }

    private sealed class ImageRow
    {
        public Guid Id { get; set; }

        public Guid OrderId { get; set; }

        public int Slot { get; set; }

        public int Position { get; set; }

        public string PublicId { get; set; } = string.Empty;

        public int Width { get; set; }

        public int Height { get; set; }

        public int Bytes { get; set; }

        public string Format { get; set; } = string.Empty;

        public DateTimeOffset CreatedAtUtc { get; set; }
    }

    private sealed class ImageRowContext(DbContextOptions<ImageRowContext> options) : DbContext(options)
    {
        public DbSet<ImageRow> Rows => Set<ImageRow>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<ImageRow>(entity =>
            {
                entity.ToTable("OrderImages");
                entity.HasKey(row => row.Id);
                entity.Property(row => row.Id).ValueGeneratedNever();
                entity.Property(row => row.Slot).HasConversion<byte>();
                entity.Property(row => row.Format).IsUnicode(false);
            });
        }
    }
}
