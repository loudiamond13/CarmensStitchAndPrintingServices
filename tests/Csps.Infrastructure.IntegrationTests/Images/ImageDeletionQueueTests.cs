using Csps.Application.Ports;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Images;

/// <summary>
/// JOB-02, D-20, IMG-01: <c>Enqueue</c> joins the request's unit of work, so a rollback keeps no row, while <c>EnqueueNowAsync</c> writes
/// on its own short context and keeps its row even when the request never saves or rolls back.
/// </summary>
public sealed class ImageDeletionQueueTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnEnqueueInsideATransactionThatThrowsBeforeTheCommitLeavesNoRow()
    {
        var publicId = NewPublicId();
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var unitOfWork = new CspsUnitOfWork(context);

        await Should.ThrowAsync<InvalidOperationException>(() => unitOfWork.InTransactionAsync<int>(
            async cancellationToken =>
            {
                queue.Enqueue(publicId, ImageDeletionReason.OrderDeleted);
                await unitOfWork.SaveChangesAsync(cancellationToken);
                throw new InvalidOperationException("The request failed after the save.");
            },
            TestContext.Current.CancellationToken));

        (await RowsAsync(publicId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEnqueueInsideATransactionThatCommitsKeepsOneDueRowWithNoAttemptsAndNoLease()
    {
        var publicId = NewPublicId();
        await using var context = database.CreateContext();
        var queue = NewQueue(context);
        var unitOfWork = new CspsUnitOfWork(context);

        await unitOfWork.InTransactionAsync(
            async cancellationToken =>
            {
                queue.Enqueue(publicId, ImageDeletionReason.PhotoDeleted);
                return await unitOfWork.SaveChangesAsync(cancellationToken);
            },
            TestContext.Current.CancellationToken);

        var row = (await RowsAsync(publicId)).ShouldHaveSingleItem();
        row.Reason.ShouldBe(ImageDeletionReason.PhotoDeleted);
        row.DeliveryType.ShouldBe("private");
        row.Attempts.ShouldBe(0);
        row.EnqueuedAtUtc.ShouldBe(Now);
        row.NextAttemptAtUtc.ShouldBe(Now);
        row.LeaseUntilUtc.ShouldBeNull();
        row.LeaseHolder.ShouldBeNull();
        row.LastFailureCode.ShouldBeNull();
        row.LastFailedAtUtc.ShouldBeNull();
        row.Id.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task AnEnqueueThatIsNeverSavedLeavesNoRow()
    {
        var publicId = NewPublicId();
        await using (var context = database.CreateContext())
        {
            NewQueue(context).Enqueue(publicId, ImageDeletionReason.OrderDeleted);
        }

        (await RowsAsync(publicId)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnEnqueueNowWritesARowEvenWhenTheSurroundingUnitOfWorkIsNeverSaved()
    {
        var publicId = NewPublicId();
        await using (var context = database.CreateContext())
        {
            await NewQueue(context).EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, TestContext.Current.CancellationToken);
        }

        var row = (await RowsAsync(publicId)).ShouldHaveSingleItem();
        row.Reason.ShouldBe(ImageDeletionReason.UploadUndone);
        row.DeliveryType.ShouldBe("private");
        row.Attempts.ShouldBe(0);
        row.NextAttemptAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task AnEnqueueNowSurvivesTheRollbackOfTheRequestsOwnTransaction()
    {
        var publicId = NewPublicId();
        await using var context = database.CreateContext();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await NewQueue(context).EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, TestContext.Current.CancellationToken);
            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }

        (await RowsAsync(publicId)).ShouldHaveSingleItem();
    }

    [Fact]
    public async Task TheSamePublicIdMayBeQueuedTwice()
    {
        var publicId = NewPublicId();
        await using var context = database.CreateContext();
        var queue = NewQueue(context);

        await queue.EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, TestContext.Current.CancellationToken);
        await queue.EnqueueNowAsync(publicId, ImageDeletionReason.Stray, TestContext.Current.CancellationToken);

        (await RowsAsync(publicId)).Select(row => row.Reason).Order().ShouldBe([ImageDeletionReason.UploadUndone, ImageDeletionReason.Stray]);
    }

    [Fact]
    public async Task AnEnqueueNowThatCannotSaveLogsOnlyTheFailureCodeAndThrowsTheError()
    {
        var publicId = NewPublicId();
        var logger = new FakeLogger<ImageDeletionQueue>();
        await using var context = database.CreateContext();
        var queue = new ImageDeletionQueue(context, new BrokenContextFactory(), new FakeTimeProvider(Now), logger);

        await Should.ThrowAsync<InvalidOperationException>(() => queue.EnqueueNowAsync(publicId, ImageDeletionReason.UploadUndone, TestContext.Current.CancellationToken));

        var record = logger.Collector.GetSnapshot().ShouldHaveSingleItem();
        record.Level.ShouldBe(LogLevel.Warning);
        record.Message.ShouldContain("image-queue-failed");
        record.Message.ShouldNotContain(publicId);
        record.Message.ShouldNotContain("csps-test");
    }

    private static string NewPublicId() => $"csps-test/orders/{Guid.NewGuid():D}/{Guid.NewGuid():N}";

    private ImageDeletionQueue NewQueue(CspsDbContext context) =>
        new(context, new TestContextFactory(database), new FakeTimeProvider(Now), new FakeLogger<ImageDeletionQueue>());

    private async Task<List<ImageDeletion>> RowsAsync(string publicId)
    {
        await using var fresh = database.CreateContext();
        return await fresh.Set<ImageDeletion>().AsNoTracking().Where(row => row.PublicId == publicId).ToListAsync(TestContext.Current.CancellationToken);
    }

    private sealed class BrokenContextFactory : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => throw new InvalidOperationException("The database is not reachable.");
    }

    private sealed class TestContextFactory(CspsDatabase database) : IDbContextFactory<CspsDbContext>
    {
        public CspsDbContext CreateDbContext() => database.CreateContext();
    }
}
