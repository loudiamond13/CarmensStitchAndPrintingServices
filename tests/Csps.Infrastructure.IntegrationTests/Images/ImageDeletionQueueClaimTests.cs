using Csps.Application.Ports;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>
/// JOB-02, D-05: the removal queue hands each due row to exactly one run. Each claim is its own conditional update, an expired lease can
/// be taken again, a row not yet due is left alone, and a failure keeps the row for the next run.
/// </summary>
public sealed class ImageDeletionQueueClaimTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Lease = TimeSpan.FromMinutes(5);

    [Fact]
    public async Task TwoClaimersRacingOverTwentyDueRowsGetEveryRowExactlyOnce()
    {
        await database.ResetAsync();
        await SeedAsync(20);
        await using var contextA = database.CreateContext();
        await using var contextB = database.CreateContext();
        var holderA = Guid.NewGuid();
        var holderB = Guid.NewGuid();

        var claims = await Task.WhenAll(
            NewQueue(contextA).ClaimDueAsync(holderA, Now, Lease, 25, TestContext.Current.CancellationToken),
            NewQueue(contextB).ClaimDueAsync(holderB, Now, Lease, 25, TestContext.Current.CancellationToken));

        var ids = claims.SelectMany(static claim => claim).Select(static row => row.Id).ToList();
        ids.Count.ShouldBe(20);
        ids.Distinct().Count().ShouldBe(20);
        var rows = await RowsAsync();
        rows.ShouldAllBe(row => row.LeaseUntilUtc == Now + Lease);
        rows.Count(row => row.LeaseHolder == holderA).ShouldBe(claims[0].Count);
        rows.Count(row => row.LeaseHolder == holderB).ShouldBe(claims[1].Count);
    }

    [Fact]
    public async Task ASecondClaimWhileTheLeaseIsHeldGetsNothing()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);

        var first = await queue.ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken);
        var second = await queue.ClaimDueAsync(Guid.NewGuid(), Now + TimeSpan.FromMinutes(1), Lease, 25, TestContext.Current.CancellationToken);

        first.Count.ShouldBe(1);
        second.ShouldBeEmpty();
    }

    [Fact]
    public async Task ARowWhoseLeaseHasExpiredCanBeClaimedAgainByAnotherRun()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        await queue.ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken);
        var newHolder = Guid.NewGuid();

        var again = await queue.ClaimDueAsync(newHolder, Now + Lease + TimeSpan.FromSeconds(1), Lease, 25, TestContext.Current.CancellationToken);

        again.Count.ShouldBe(1);
        (await RowsAsync()).ShouldHaveSingleItem().LeaseHolder.ShouldBe(newHolder);
    }

    [Fact]
    public async Task ARowWhoseNextAttemptIsInTheFutureIsNotClaimedUntilItIsDue()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var due = Now + TimeSpan.FromHours(1);
        await context.Set<ImageDeletion>().ExecuteUpdateAsync(calls => calls.SetProperty(row => row.NextAttemptAtUtc, due), TestContext.Current.CancellationToken);
        var queue = NewQueue(context);

        var early = await queue.ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken);
        var onTime = await queue.ClaimDueAsync(Guid.NewGuid(), due, Lease, 25, TestContext.Current.CancellationToken);

        early.ShouldBeEmpty();
        onTime.Count.ShouldBe(1);
    }

    [Fact]
    public async Task AClaimTakesNoMoreThanTheMaximum()
    {
        await database.ResetAsync();
        await SeedAsync(30);
        await using var context = database.CreateContext();

        var claimed = await NewQueue(context).ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken);

        claimed.Count.ShouldBe(25);
        (await RowsAsync()).Count(row => row.LeaseHolder != null).ShouldBe(25);
    }

    [Fact]
    public async Task ACompleteDeletesTheRowOnlyForTheRunThatHoldsTheLease()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var holder = Guid.NewGuid();
        var row = (await queue.ClaimDueAsync(holder, Now, Lease, 25, TestContext.Current.CancellationToken)).ShouldHaveSingleItem();

        await queue.CompleteAsync(row.Id, Guid.NewGuid(), TestContext.Current.CancellationToken);
        (await RowsAsync()).Count.ShouldBe(1);
        await queue.CompleteAsync(row.Id, holder, TestContext.Current.CancellationToken);

        (await RowsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task AFailureKeepsTheRowWithOneMoreAttemptItsCodeAndNoLeaseAndItIsDueAgainAtOnce()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var holder = Guid.NewGuid();
        var row = (await queue.ClaimDueAsync(holder, Now, Lease, 25, TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
        var failedAt = Now + TimeSpan.FromSeconds(30);

        await queue.FailAsync(row.Id, holder, "transient", failedAt, TestContext.Current.CancellationToken);

        var kept = (await RowsAsync()).ShouldHaveSingleItem();
        kept.Attempts.ShouldBe(1);
        kept.LastFailureCode.ShouldBe("transient");
        kept.LastFailedAtUtc.ShouldBe(failedAt);
        kept.NextAttemptAtUtc.ShouldBe(failedAt);
        kept.LeaseUntilUtc.ShouldBeNull();
        kept.LeaseHolder.ShouldBeNull();
        (await queue.ClaimDueAsync(Guid.NewGuid(), failedAt, Lease, 25, TestContext.Current.CancellationToken)).Count.ShouldBe(1);
    }

    [Fact]
    public async Task AFailureFromARunThatLostTheLeaseChangesNothing()
    {
        await database.ResetAsync();
        await SeedAsync(1);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var row = (await queue.ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken)).ShouldHaveSingleItem();

        await queue.FailAsync(row.Id, Guid.NewGuid(), "transient", Now, TestContext.Current.CancellationToken);

        var kept = (await RowsAsync()).ShouldHaveSingleItem();
        kept.Attempts.ShouldBe(0);
        kept.LastFailureCode.ShouldBeNull();
    }

    [Fact]
    public async Task AReleaseLetsAnotherRunClaimTheRowAtOnce()
    {
        await database.ResetAsync();
        await SeedAsync(2);
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var holder = Guid.NewGuid();
        var claimed = await queue.ClaimDueAsync(holder, Now, Lease, 25, TestContext.Current.CancellationToken);

        await queue.ReleaseAsync([claimed[0].Id], holder, TestContext.Current.CancellationToken);
        var next = await queue.ClaimDueAsync(Guid.NewGuid(), Now, Lease, 25, TestContext.Current.CancellationToken);

        next.ShouldHaveSingleItem().Id.ShouldBe(claimed[0].Id);
    }

    private ImageDeletionQueue NewQueue(CspsDbContext context) =>
        new(context, new TestContextFactory(database), new FakeTimeProvider(Now), new FakeLogger<ImageDeletionQueue>());

    private async Task SeedAsync(int count)
    {
        await using var context = database.CreateContext();
        for (var index = 0; index < count; index++)
        {
            context.Set<ImageDeletion>().Add(ImageDeletion.Queue($"csps-test/orders/{Guid.NewGuid():D}/{Guid.NewGuid():N}", "private", ImageDeletionReason.PhotoDeleted, Now));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<List<ImageDeletion>> RowsAsync()
    {
        await using var fresh = database.CreateContext();
        return await fresh.Set<ImageDeletion>().AsNoTracking().OrderBy(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    private sealed class TestContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }
}
