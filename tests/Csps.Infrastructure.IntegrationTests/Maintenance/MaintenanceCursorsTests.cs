using Csps.Infrastructure.Maintenance;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>D-54: the place a job reached is kept per job name, replaced on a second save, and forgotten on a clear.</summary>
public sealed class MaintenanceCursorsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 5, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AJobWithNoSavedPlaceReadsNull()
    {
        var job = NewJobName();
        await using var context = database.CreateContext();

        (await NewStore(context).GetAsync(job, TestContext.Current.CancellationToken)).ShouldBeNull();
    }

    [Fact]
    public async Task ASavedPlaceIsReadBackFromANewContext()
    {
        var job = NewJobName();
        await using (var context = database.CreateContext())
        {
            await NewStore(context).SaveAsync(job, "cursor-1", TestContext.Current.CancellationToken);
        }

        await using var fresh = database.CreateContext();
        (await NewStore(fresh).GetAsync(job, TestContext.Current.CancellationToken)).ShouldBe("cursor-1");
        var row = await fresh.Set<MaintenanceCursor>().AsNoTracking().SingleAsync(item => item.JobName == job, TestContext.Current.CancellationToken);
        row.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task ASecondSaveReplacesThePlaceInTheSameRow()
    {
        var job = NewJobName();
        await using var context = database.CreateContext();
        var store = NewStore(context);

        await store.SaveAsync(job, "cursor-1", TestContext.Current.CancellationToken);
        await store.SaveAsync(job, "cursor-2", TestContext.Current.CancellationToken);

        (await store.GetAsync(job, TestContext.Current.CancellationToken)).ShouldBe("cursor-2");
        await using var fresh = database.CreateContext();
        (await fresh.Set<MaintenanceCursor>().CountAsync(item => item.JobName == job, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task PlacesOfDifferentJobsDoNotMix()
    {
        var first = NewJobName();
        var second = NewJobName();
        await using var context = database.CreateContext();
        var store = NewStore(context);

        await store.SaveAsync(first, "cursor-a", TestContext.Current.CancellationToken);
        await store.SaveAsync(second, "cursor-b", TestContext.Current.CancellationToken);
        await store.ClearAsync(first, TestContext.Current.CancellationToken);

        (await store.GetAsync(first, TestContext.Current.CancellationToken)).ShouldBeNull();
        (await store.GetAsync(second, TestContext.Current.CancellationToken)).ShouldBe("cursor-b");
    }

    [Fact]
    public async Task AClearOfAJobWithNoPlaceDoesNothing()
    {
        await using var context = database.CreateContext();

        await Should.NotThrowAsync(() => NewStore(context).ClearAsync(NewJobName(), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ACursorLongerThanTheColumnIsNotKeptAndDropsTheEarlierPlace()
    {
        var job = NewJobName();
        await using var context = database.CreateContext();
        var store = NewStore(context);
        await store.SaveAsync(job, "cursor-1", TestContext.Current.CancellationToken);

        await store.SaveAsync(job, new string('x', MaintenanceCursor.CursorMaxLength + 1), TestContext.Current.CancellationToken);

        (await store.GetAsync(job, TestContext.Current.CancellationToken)).ShouldBeNull();
    }

    [Fact]
    public async Task ACursorOfTheFullColumnLengthIsKept()
    {
        var job = NewJobName();
        var cursor = new string('x', MaintenanceCursor.CursorMaxLength);
        await using var context = database.CreateContext();
        var store = NewStore(context);

        await store.SaveAsync(job, cursor, TestContext.Current.CancellationToken);

        (await store.GetAsync(job, TestContext.Current.CancellationToken)).ShouldBe(cursor);
    }

    private static string NewJobName() => $"job-{Guid.NewGuid():N}";

    private static MaintenanceCursors NewStore(CspsDbContext context) => new(context, new FakeTimeProvider(Now));
}
