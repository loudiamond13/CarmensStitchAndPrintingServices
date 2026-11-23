using System.Data.Common;
using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Domain.Time;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Maintenance;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>
/// INQ-07, Phase 12 D-02, D-07, D-22: the daily run removes every quote request that is not Converted and was received before the 6-month
/// cut, after queuing each stored photo for removal. A converted request and its photos are never purged by age.
/// </summary>
public sealed class QuoteRequestRetentionJobTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string RemovedLabel = "Old quote requests removed";

    // 2026-11-21 12:00 in Manila; the cut is 2026-05-21 00:00 in Manila, which is 2026-05-20 16:00 UTC.
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 4, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Cut = new(2026, 5, 20, 16, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task OldUnconvertedRequestsAndTheirPhotosGo()
    {
        await database.ResetAsync();
        var first = $"csps-test/quotes/{Guid.NewGuid():D}/photoonephotoonephotoone2";
        var second = $"csps-test/quotes/{Guid.NewGuid():D}/phototwophototwophototwo2";
        var id = await AddRequestAsync(Cut.AddTicks(-1), QuoteRequestStatus.New, 3, (0, first), (1, second));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RemovedLabel).Value.ShouldBe(1);
        Line(report, RemovedLabel).Failed.ShouldBeFalse();
        report.More.ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.QuoteRequests.AnyAsync(request => request.Id == id, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await context.QuoteRequestPhotos.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        var queued = await context.Set<ImageDeletion>().AsNoTracking().OrderBy(row => row.PublicId).ToListAsync(TestContext.Current.CancellationToken);
        queued.Select(row => row.PublicId).ShouldBe([first, second], ignoreOrder: true);
        queued.ShouldAllBe(row => row.Reason == ImageDeletionReason.QuotePurged);
    }

    [Fact]
    public async Task ARequestAtTheCutStays()
    {
        await database.ResetAsync();
        var photo = $"csps-test/quotes/{Guid.NewGuid():D}/photokeptphotokeptphotokept";
        var id = await AddRequestAsync(Cut, QuoteRequestStatus.New, 1, (0, photo));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RemovedLabel).Value.ShouldBe(0);
        await using var context = database.CreateContext();
        (await context.QuoteRequests.AnyAsync(request => request.Id == id, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await context.QuoteRequestPhotos.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ConvertedRequestsAreKept()
    {
        await database.ResetAsync();
        var photo = $"csps-test/quotes/{Guid.NewGuid():D}/photoconvphotoconvphotoconv";
        var id = await AddRequestAsync(Now.AddYears(-1), QuoteRequestStatus.Converted, 1, (0, photo));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RemovedLabel).Value.ShouldBe(0);
        await using var context = database.CreateContext();
        (await context.QuoteRequests.AnyAsync(request => request.Id == id, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await context.QuoteRequestPhotos.CountAsync(photoRow => photoRow.PublicId == photo, TestContext.Current.CancellationToken)).ShouldBe(1);
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Theory]
    [InlineData(QuoteRequestStatus.New)]
    [InlineData(QuoteRequestStatus.Contacted)]
    [InlineData(QuoteRequestStatus.Quoted)]
    [InlineData(QuoteRequestStatus.Closed)]
    [InlineData(QuoteRequestStatus.Spam)]
    public async Task SpamAndClosedAreCountedLikeAnyOther(QuoteRequestStatus status)
    {
        await database.ResetAsync();
        await AddRequestAsync(Now.AddYears(-1), status, 0);
        await AddRequestAsync(Now.AddMonths(-1), status, 0);

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RemovedLabel).Value.ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.QuoteRequests.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ABatchStopsForTheBudgetAndTheNextRunFinishes()
    {
        await database.ResetAsync();
        await AddManyRequestsAsync(250, Cut.AddDays(-1));
        var clock = new FakeTimeProvider(Now);

        var first = await RunAsync(clock, new SpendBudgetAfterFirst(clock, MaintenanceBudget.DefaultDuration, "DELETE|QuoteRequests"), new MaintenanceBudget(clock));

        QuoteRequestRetentionJob.BatchSize.ShouldBe(200);
        Line(first, RemovedLabel).Value.ShouldBe(200);
        first.More.ShouldBeTrue();
        await using (var context = database.CreateContext())
        {
            (await context.QuoteRequests.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(50);
        }

        var second = await RunAsync(new FakeTimeProvider(Now));

        Line(second, RemovedLabel).Value.ShouldBe(50);
        second.More.ShouldBeFalse();
    }

    [Fact]
    public async Task AFailedRemovalIsTheFailedLineAndQueuesNothing()
    {
        await database.ResetAsync();
        var photo = $"csps-test/quotes/{Guid.NewGuid():D}/photofailphotofailphotofail";
        var id = await AddRequestAsync(Cut.AddDays(-1), QuoteRequestStatus.New, 1, (0, photo));

        var report = await RunAsync(new FakeTimeProvider(Now), new FailDeletesOn("QuoteRequests"));

        var line = Line(report, RemovedLabel);
        line.Failed.ShouldBeTrue();
        line.Value.ShouldBeNull();
        line.Text.ShouldBe("The old quote requests could not be removed.");
        report.More.ShouldBeFalse();
        await using var context = database.CreateContext();
        (await context.QuoteRequests.AnyAsync(request => request.Id == id, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await context.Set<ImageDeletion>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public void TheJobRunsBeforeThePhotoRemovalsUnderItsFixedName()
    {
        using var context = database.CreateContext();
        var job = NewJob(context, new FakeTimeProvider(Now));

        job.Order.ShouldBe(12);
        job.Name.ShouldBe("quote-request-retention");
    }

    [Fact]
    public void TheQuoteRemovalReasonsKeepTheirStoredNumbers()
    {
        ((int)ImageDeletionReason.QuoteSpam).ShouldBe(6);
        ((int)ImageDeletionReason.QuoteDeleted).ShouldBe(7);
        ((int)ImageDeletionReason.QuotePurged).ShouldBe(8);
    }

    private static MaintenanceLine Line(MaintenanceJobReport report, string label) => report.Lines.Single(line => line.Label == label);

    private QuoteRequestRetentionJob NewJob(CspsDbContext context, FakeTimeProvider clock) =>
        new(
            context,
            new ManilaCalendar(clock),
            new ImageDeletionQueue(context, new TestContextFactory(database), clock, NullLogger<ImageDeletionQueue>.Instance),
            NullLogger<QuoteRequestRetentionJob>.Instance);

    private async Task<MaintenanceJobReport> RunAsync(FakeTimeProvider clock, IInterceptor? hook = null, MaintenanceBudget? budget = null)
    {
        await using var context = hook is null ? database.CreateContext() : database.CreateContext(hook);
        var job = NewJob(context, clock);
        return await job.RunAsync(budget ?? new MaintenanceBudget(clock), TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task APurgedRequestTakesItsStatusHistoryWithIt()
    {
        await database.ResetAsync();
        var staff = await OrderSeeding.AddStaffAsync(database, "Mina", Now);
        var purged = await AddRequestAsync(Cut.AddTicks(-1), QuoteRequestStatus.New, 0);
        var kept = await AddRequestAsync(Cut, QuoteRequestStatus.New, 0);
        await MoveAsync(purged, staff);
        await MoveAsync(kept, staff);

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, RemovedLabel).Value.ShouldBe(1);
        await using var context = database.CreateContext();
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == purged, TestContext.Current.CancellationToken)).ShouldBe(0);
        (await context.QuoteRequestStatusChanges.CountAsync(change => change.QuoteRequestId == kept, TestContext.Current.CancellationToken)).ShouldBe(2);
    }

    // Two staff moves, so the request has history rows; the received time stays as seeded.
    private async Task MoveAsync(Guid id, Guid staff)
    {
        await using var context = database.CreateContext();
        var request = await context.QuoteRequests.SingleAsync(row => row.Id == id, TestContext.Current.CancellationToken);
        request.ChangeStatus(QuoteRequestStatus.Contacted, staff, Now.AddDays(-1)).IsSuccess.ShouldBeTrue();
        request.ChangeStatus(QuoteRequestStatus.Closed, staff, Now.AddDays(-1).AddMinutes(1)).IsSuccess.ShouldBeTrue();
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    // Saves a request with its declared photo places, then sets the received time, the status and the stored files straight in the
    // table: the stamp on save would otherwise write the real clock.
    private async Task<Guid> AddRequestAsync(DateTimeOffset receivedAt, QuoteRequestStatus status, int declared, params (int Slot, string PublicId)[] stored)
    {
        var request = QuoteRequest.Receive(Guid.CreateVersion7(receivedAt), Input(), receivedAt).Value;
        if (declared > 0)
        {
            request.DeclarePhotos([.. Enumerable.Range(0, declared).Select(slot => $"photo-{slot}.jpg")], new byte[QuoteRequestRules.UploadKeyHashLength], receivedAt.AddHours(2)).IsSuccess.ShouldBeTrue();
        }

        await using var context = database.CreateContext();
        context.QuoteRequests.Add(request);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        await SetReceivedAsync(context, [request.Id], receivedAt, status);
        foreach (var (slot, publicId) in stored)
        {
            var requestId = request.Id;
            var slotNumber = slot;
            await context.QuoteRequestPhotos
                .Where(photo => photo.QuoteRequestId == requestId && photo.Slot == slotNumber)
                .ExecuteUpdateAsync(set => set.SetProperty(photo => photo.PublicId, publicId), TestContext.Current.CancellationToken);
        }

        return request.Id;
    }

    private async Task AddManyRequestsAsync(int count, DateTimeOffset receivedAt)
    {
        var requests = Enumerable.Range(0, count).Select(_ => QuoteRequest.Receive(Guid.CreateVersion7(receivedAt), Input(), receivedAt).Value).ToList();
        await using var context = database.CreateContext();
        context.QuoteRequests.AddRange(requests);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        await SetReceivedAsync(context, [.. requests.Select(request => request.Id)], receivedAt, QuoteRequestStatus.New);
    }

    private static Task<int> SetReceivedAsync(CspsDbContext context, IReadOnlyCollection<Guid> ids, DateTimeOffset receivedAt, QuoteRequestStatus status) =>
        context.QuoteRequests
            .Where(request => ids.Contains(request.Id))
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(request => request.CreatedAtUtc, receivedAt)
                    .SetProperty(request => request.Status, status),
                TestContext.Current.CancellationToken);

    private static QuoteRequestInput Input() =>
        new("Juan Dela Cruz", null, "0917 123 4567", null, null, null, null, null, null);

    // The business clock for Asia/Manila at the fake time.
    private sealed class ManilaCalendar(FakeTimeProvider clock) : IBusinessCalendar
    {
        public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
        {
            var (zone, source) = TimeZoneResolver.Resolve("Asia/Manila");
            return ValueTask.FromResult(new BusinessClock(zone, source, clock.GetUtcNow()));
        }
    }

    private sealed class TestContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }

    private sealed class TestDatabaseException() : DbException("The test database failed.");

    // Fails every delete on one table with a database error.
    private sealed class FailDeletesOn(string table) : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE", StringComparison.Ordinal) && command.CommandText.Contains(table, StringComparison.Ordinal))
            {
                throw new TestDatabaseException();
            }

            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    // Moves the clock forward once the first command holding every '|'-separated part of the marker has run, as if that step took the whole budget.
    private sealed class SpendBudgetAfterFirst(FakeTimeProvider clock, TimeSpan by, string marker) : DbCommandInterceptor
    {
        private int _advanced;

        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            Advance(command);
            return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
        }

        private void Advance(DbCommand command)
        {
            var matches = marker.Split('|').All(part => command.CommandText.Contains(part, StringComparison.Ordinal));
            if (matches && Interlocked.Exchange(ref _advanced, 1) == 0)
            {
                clock.Advance(by);
            }
        }
    }
}
