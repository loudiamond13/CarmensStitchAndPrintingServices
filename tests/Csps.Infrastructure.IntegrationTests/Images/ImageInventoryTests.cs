using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Images;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>
/// JOB-02, D-23, T-09-68: the inventory counts a photo of a soft-deleted order as known, so the sweep and the removal job never destroy a
/// file that a restored order would need.
/// </summary>
public sealed class ImageInventoryTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string LivePhoto = "csps-test/orders/live/photo-live";
    private const string DeletedPhoto = "csps-test/orders/deleted/photo-deleted";
    private const string QueuedOnly = "csps-test/orders/gone/photo-queued";
    private const string Unknown = "csps-test/orders/none/photo-unknown";

    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 11, 3);

    [Fact]
    public async Task APhotoOfALiveOrderIsKnownAndNamedByAPhoto()
    {
        await SeedAsync();
        await using var context = database.CreateContext();
        var inventory = new ImageInventory(context);

        (await inventory.KnownAsync([LivePhoto], TestContext.Current.CancellationToken)).ShouldBe([LivePhoto]);
        (await inventory.NamedByPhotosAsync([LivePhoto], TestContext.Current.CancellationToken)).ShouldBe([LivePhoto]);
    }

    [Fact]
    public async Task APhotoOfASoftDeletedOrderIsKnownAndNamedByAPhoto()
    {
        await SeedAsync();
        await using var context = database.CreateContext();
        var inventory = new ImageInventory(context);

        (await inventory.KnownAsync([DeletedPhoto], TestContext.Current.CancellationToken)).ShouldBe([DeletedPhoto]);
        (await inventory.NamedByPhotosAsync([DeletedPhoto], TestContext.Current.CancellationToken)).ShouldBe([DeletedPhoto]);
    }

    [Fact]
    public async Task AnIdWithOnlyAQueueRowIsKnownButNotNamedByAPhoto()
    {
        await SeedAsync();
        await using var context = database.CreateContext();
        var inventory = new ImageInventory(context);

        (await inventory.KnownAsync([QueuedOnly], TestContext.Current.CancellationToken)).ShouldBe([QueuedOnly]);
        (await inventory.NamedByPhotosAsync([QueuedOnly], TestContext.Current.CancellationToken)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnUnknownIdIsNotKnownAndNotNamedByAPhoto()
    {
        await SeedAsync();
        await using var context = database.CreateContext();
        var inventory = new ImageInventory(context);

        (await inventory.KnownAsync([Unknown], TestContext.Current.CancellationToken)).ShouldBeEmpty();
        (await inventory.NamedByPhotosAsync([Unknown], TestContext.Current.CancellationToken)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AMixedListAnswersOnlyTheKnownIdsWhateverTheLetterCase()
    {
        await SeedAsync();
        await using var context = database.CreateContext();
        var inventory = new ImageInventory(context);

        var known = await inventory.KnownAsync([LivePhoto.ToUpperInvariant(), DeletedPhoto, QueuedOnly, Unknown], TestContext.Current.CancellationToken);

        known.Count.ShouldBe(3);
        known.Contains(LivePhoto).ShouldBeTrue();
        known.Contains(DeletedPhoto).ShouldBeTrue();
        known.Contains(QueuedOnly).ShouldBeTrue();
        known.Contains(Unknown).ShouldBeFalse();
    }

    [Fact]
    public async Task AnEmptyListAsksTheDatabaseNothing()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var inventory = new ImageInventory(context);

        counter.Reset();
        (await inventory.KnownAsync([], TestContext.Current.CancellationToken)).ShouldBeEmpty();
        (await inventory.NamedByPhotosAsync([], TestContext.Current.CancellationToken)).ShouldBeEmpty();

        counter.Count.ShouldBe(0);
    }

    [Fact]
    public async Task AFullPageOfFiveHundredIdsIsCheckedInTwoCommands()
    {
        await SeedAsync();
        var counter = new CommandCounter();
        await using var context = database.CreateContext(counter);
        var inventory = new ImageInventory(context);
        var ids = Enumerable.Range(0, 500).Select(number => $"csps-test/orders/page/photo-{number:D4}").Append(LivePhoto).ToList();

        counter.Reset();
        var known = await inventory.KnownAsync(ids, TestContext.Current.CancellationToken);

        known.ShouldBe([LivePhoto]);
        counter.Count.ShouldBe(2, string.Join(Environment.NewLine, counter.Commands));
    }

    private async Task SeedAsync()
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
        context.Orders.Add(NewOrder(callerId, "ORD-2026-0001", LivePhoto, deleted: false));
        context.Orders.Add(NewOrder(callerId, "ORD-2026-0002", DeletedPhoto, deleted: true));
        context.Set<ImageDeletion>().Add(ImageDeletion.Queue(QueuedOnly, "private", ImageDeletionReason.PhotoDeleted, Now));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static Order NewOrder(Guid callerId, string number, string photoId, bool deleted)
    {
        var order = Order.Create(
            new NewOrder(
                new OrderDetails("Juan Dela Cruz", null, "0917 123 4567", null, null, Today, Today.AddDays(14), null),
                OrderStatus.Pending,
                [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Jersey top", null, 2, 650.00m)]),
            callerId,
            Now).Value;
        order.AssignNumber(number);
        order.AddImage(new NewOrderImage(photoId, 1600, 1200, 250_000, "jpg", null), Now).IsSuccess.ShouldBeTrue();
        if (deleted)
        {
            order.SoftDelete(callerId, Now.AddMinutes(5));
        }

        return order;
    }
}
