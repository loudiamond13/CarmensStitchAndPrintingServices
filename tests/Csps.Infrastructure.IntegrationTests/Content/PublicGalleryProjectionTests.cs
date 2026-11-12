using System.Data.Common;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Content;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// GAL-01, D-08, D-10 to D-15, D-30, D-38: the one projection of what the public may see of the gallery. Each case leaves one kind of
/// order out, and the rest prove the counts, the order and the text. Every read uses a new cache, so it sees the database as it is.
/// </summary>
public sealed class PublicGalleryProjectionTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnOrderWithEverythingInPlaceIsOneItemWithItsNameLinePiecesAndPhotosInOrder()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Brgy. Sample Ballers") { Pieces = 17, Photos = [(800, 600), (600, 800), (1000, 1000)] }], staff, Now);

        var gallery = (await ReadAsync()).Gallery;

        var item = gallery.Items.ShouldHaveSingleItem();
        item.Team.ShouldBe("Brgy. Sample Ballers");
        item.LineKey.ShouldBe("basketball");
        item.LineShortName.ShouldBe("Basketball");
        item.Pieces.ShouldBe(17);
        item.Note.ShouldBeNull();
        item.PlaceholderArt.ShouldBe("basketball");
        item.Photos.Select(photo => (photo.Width, photo.Height)).ShouldBe([(800, 600), (600, 800), (1000, 1000)]);
        gallery.Total.ShouldBe(1);
    }

    [Fact]
    public async Task AnOrderWithNoRecordedOkIsLeftOutEvenWhenItsEntryAndShownDateExist()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("No OK") { Consent = false, Show = true }], staff, Now);

        (await ReadAsync()).Gallery.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnOrderWithTheOkButNotShownIsLeftOutEvenWhenItHasAnEntry()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Not shown") { Show = false, ForceEntry = true }], staff, Now);

        (await ReadAsync()).Gallery.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnOrderCancelledWhileStillFlaggedShownIsLeftOut()
    {
        var staff = await PrepareAsync();
        var ids = await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Shown then cancelled")], staff, Now);
        (await ReadAsync()).Gallery.Items.Count.ShouldBe(1);

        await using (var context = database.CreateContext())
        {
            await context.Orders.Where(order => order.Id == ids[0]).ExecuteUpdateAsync(
                update => update.SetProperty(order => order.Status, Csps.Domain.Orders.OrderStatus.Cancelled), TestContext.Current.CancellationToken);
        }

        (await ReadAsync()).Gallery.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task ASoftDeletedShownOrderIsLeftOutAndComesBackWhenItIsRestored()
    {
        var staff = await PrepareAsync();
        var ids = await GallerySeeding.AddOrdersAsync(
            database,
            [new SeedGalleryOrder("Deleted") { Deleted = true }, new SeedGalleryOrder("Kept") { Position = 5 }],
            staff,
            Now);

        (await ReadAsync()).Gallery.Items.Select(item => item.Team).ShouldBe(["Kept"]);

        await using (var context = database.CreateContext())
        {
            await context.Orders.IgnoreQueryFilters().Where(order => order.Id == ids[0]).ExecuteUpdateAsync(
                update => update.SetProperty(order => order.DeletedAtUtc, (DateTimeOffset?)null), TestContext.Current.CancellationToken);
        }

        (await ReadAsync()).Gallery.Items.Select(item => item.Team).ShouldBe(["Deleted", "Kept"]);
    }

    [Fact]
    public async Task AnOrderFiledUnderAHiddenLineIsLeftOutAndAnOverrideToAShownLineBringsItBack()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(
            database,
            [
                new SeedGalleryOrder("Auto hidden") { LineKey = "volleyball", Position = 1 },
                new SeedGalleryOrder("Override shown") { LineKey = "volleyball", LineOverrideKey = "basketball", Position = 2 },
                new SeedGalleryOrder("Override hidden") { LineKey = "basketball", LineOverrideKey = "volleyball", Position = 3 },
                new SeedGalleryOrder("Plain basketball") { Position = 4 },
            ],
            staff,
            Now);
        await HideLineAsync("volleyball");

        var items = (await ReadAsync()).Gallery.Items;

        items.Select(item => item.Team).ShouldBe(["Override shown", "Plain basketball"]);
        items.ShouldAllBe(item => item.LineKey == "basketball");
    }

    [Fact]
    public async Task AnOrderWithNoPhotoIsLeftOut()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("No photo") { Photos = [] }], staff, Now);

        (await ReadAsync()).Gallery.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task AnOrderFiledUnderNoLineAndWithNoOverrideIsLeftOut()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Unfiled") { Unfiled = true }], staff, Now);

        (await ReadAsync()).Gallery.Items.ShouldBeEmpty();
    }

    [Fact]
    public async Task PillCountsEqualTheItemsOfEachLineHiddenLinesHaveNoPillAndAnEmptyGalleryHasNone()
    {
        var staff = await PrepareAsync();
        var empty = (await ReadAsync()).Gallery;
        empty.Items.ShouldBeEmpty();
        empty.Pills.ShouldBeEmpty();
        empty.Total.ShouldBe(0);

        await GallerySeeding.AddOrdersAsync(
            database,
            [
                new SeedGalleryOrder("B1") { LineKey = "basketball", Position = 1 },
                new SeedGalleryOrder("V1") { LineKey = "volleyball", Position = 2 },
                new SeedGalleryOrder("B2") { LineKey = "basketball", Position = 3 },
                new SeedGalleryOrder("M1") { LineKey = "moto", Position = 4 },
            ],
            staff,
            Now);
        await HideLineAsync("moto");

        var gallery = (await ReadAsync()).Gallery;

        gallery.Pills.ShouldBe([new PublicGalleryPillDto("basketball", "Basketball", 2), new PublicGalleryPillDto("volleyball", "Volleyball", 1)]);
        gallery.Total.ShouldBe(3);
        gallery.Items.Count.ShouldBe(gallery.Pills.Sum(pill => pill.Count));
    }

    [Fact]
    public async Task ItemsFollowTheEntryPositionAndEntriesThatShareOneComeInIdOrder()
    {
        var staff = await PrepareAsync();
        var ids = await GallerySeeding.AddOrdersAsync(
            database,
            [
                new SeedGalleryOrder("Third") { Position = 30 },
                new SeedGalleryOrder("First") { Position = 10 },
                new SeedGalleryOrder("Second A") { Position = 20 },
                new SeedGalleryOrder("Second B") { Position = 20 },
            ],
            staff,
            Now);

        var teams = (await ReadAsync()).Gallery.Items.Select(item => item.Team).ToList();

        teams.Take(1).ShouldBe(["First"]);
        teams.Last().ShouldBe("Third");
        var entryIds = await EntryIdsAsync(ids);
        var tied = new[] { ("Second A", entryIds[ids[2]]), ("Second B", entryIds[ids[3]]) }.OrderBy(pair => pair.Item2).Select(pair => pair.Item1);
        teams.Skip(1).Take(2).ShouldBe(tied);
    }

    [Fact]
    public async Task ThePublicNameWinsOverTheTeamWhenSet()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(
            database,
            [new SeedGalleryOrder("Brgy. Sample Ballers") { PublicName = "Sample Hoopers", Position = 1 }, new SeedGalleryOrder("Plain Team") { Position = 2 }],
            staff,
            Now);

        (await ReadAsync()).Gallery.Items.Select(item => item.Team).ShouldBe(["Sample Hoopers", "Plain Team"]);
    }

    [Fact]
    public async Task AnUploadIsPublicOnlyWhenShownAndItsLineIsShownAndItCarriesItsNoteAndPieces()
    {
        await PrepareAsync();
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Sample Spikers", "volleyball") { Pieces = 12, Note = "Sample note", Position = 1 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("No pieces", "volleyball") { Position = 2 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Hidden upload", "volleyball") { Shown = false, Position = 3 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Hidden line", "moto") { Position = 4 }, Now);
        await HideLineAsync("moto");

        var items = (await ReadAsync()).Gallery.Items;

        items.Select(item => item.Team).ShouldBe(["Sample Spikers", "No pieces"]);
        items[0].Pieces.ShouldBe(12);
        items[0].Note.ShouldBe("Sample note");
        items[0].Photos.ShouldHaveSingleItem();
        items[1].Pieces.ShouldBeNull();
        items[1].Note.ShouldBeNull();
    }

    [Fact]
    public async Task OrdersAndUploadsShareOneOrderByPositionAndOnlyOrdersCarryPiecesFromTheirItems()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Order at 2") { Pieces = 9, Position = 2 }], staff, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Upload at 1", "basketball") { Position = 1 }, Now);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("Upload at 3", "basketball") { Position = 3 }, Now);

        var items = (await ReadAsync()).Gallery.Items;

        items.Select(item => item.Team).ShouldBe(["Upload at 1", "Order at 2", "Upload at 3"]);
        items[1].Pieces.ShouldBe(9);
    }

    [Fact]
    public async Task ADeadlockVictimOnTheFirstReadIsReadAgainAndTheSecondAttemptAnswers()
    {
        var staff = await PrepareAsync();
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Brgy. Sample Ballers")], staff, Now);
        var failing = new FailTheFirstReads(await DeadlockAsync(), 1);
        await using var context = database.CreateContext(failing);

        var read = await PublicGalleryProjection.LoadAsync(context, TestContext.Current.CancellationToken);

        failing.Thrown.ShouldBe(1);
        read.Items.Select(item => item.Team).ShouldBe(["Brgy. Sample Ballers"]);
    }

    [Fact]
    public async Task ADeadlockVictimOnEveryOneOfThreeAttemptsSurfacesTheThirdFailure()
    {
        await PrepareAsync();
        var failing = new FailTheFirstReads(await DeadlockAsync(), 3);
        await using var context = database.CreateContext(failing);

        var error = await Should.ThrowAsync<Exception>(() => PublicGalleryProjection.LoadAsync(context, TestContext.Current.CancellationToken));

        SqlErrors.Has(error, SqlErrors.DeadlockVictim).ShouldBeTrue();
        failing.Thrown.ShouldBe(3);
    }

    [Fact]
    public async Task AnOtherErrorIsNotReadAgain()
    {
        await PrepareAsync();
        var failing = new FailTheFirstReads(new InvalidOperationException("Not a deadlock."), 1);
        await using var context = database.CreateContext(failing);

        await Should.ThrowAsync<InvalidOperationException>(() => PublicGalleryProjection.LoadAsync(context, TestContext.Current.CancellationToken));

        failing.Thrown.ShouldBe(1);
    }

    // A real deadlock as EF reports it: two transactions each update one standing lock row, then reach for the other's.
    private async Task<Exception> DeadlockAsync()
    {
        await using var one = database.CreateContext();
        await using var two = database.CreateContext();
        var first = await one.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        var second = await two.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (first)
        await using (second)
        {
            await TouchAsync(one, "account-token:60");
            await TouchAsync(two, "account-token:61");
            var outcomes = await Task.WhenAll(CaptureAsync(() => TouchAsync(one, "account-token:61")), CaptureAsync(() => TouchAsync(two, "account-token:60")))
                .WaitAsync(TimeSpan.FromSeconds(60), TestContext.Current.CancellationToken);
            return outcomes.Single(outcome => outcome is not null).ShouldNotBeNull();
        }

        static Task TouchAsync(CspsDbContext context, string lockName) =>
            context.Set<DatabaseLock>().Where(row => row.Name == lockName)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.TakenAtUtc, Now), TestContext.Current.CancellationToken);

        static async Task<Exception?> CaptureAsync(Func<Task> work)
        {
            try
            {
                await work();
                return null;
            }
            catch (InvalidOperationException error) when (SqlErrors.Has(error, SqlErrors.DeadlockVictim))
            {
                return error;
            }
        }
    }

    // Throws the given error from the first reader commands, one error per command, then lets the rest through.
    private sealed class FailTheFirstReads(Exception error, int failures) : DbCommandInterceptor
    {
        private int _thrown;

        public int Thrown => _thrown;

        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken cancellationToken = default)
        {
            if (_thrown < failures)
            {
                _thrown++;
                throw error;
            }

            return ValueTask.FromResult(result);
        }
    }

    private async Task<Guid> PrepareAsync()
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.LinkProductTypesAsync(database);
        return await OrderSeeding.AddStaffAsync(database, "Gallery", Now);
    }

    private async Task HideLineAsync(string key)
    {
        await using var context = database.CreateContext();
        await context.ProductLines.Where(line => line.Key == key).ExecuteUpdateAsync(
            update => update.SetProperty(line => line.IsActive, false), TestContext.Current.CancellationToken);
    }

    private async Task<Dictionary<Guid, Guid>> EntryIdsAsync(IReadOnlyList<Guid> orderIds)
    {
        await using var context = database.CreateContext();
        return await context.GalleryEntries.AsNoTracking()
            .Where(entry => entry.OrderId != null && orderIds.Contains(entry.OrderId.Value))
            .ToDictionaryAsync(entry => entry.OrderId!.Value, entry => entry.Id, TestContext.Current.CancellationToken);
    }

    private async Task<PublicGallerySnapshot> ReadAsync()
    {
        await using var services = PublicContentServices.Build(database.ConnectionString);
        await using var scope = services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<IPublicContentReader>().GetGalleryAsync(TestContext.Current.CancellationToken);
    }
}
