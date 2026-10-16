using Csps.Application.Common;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// SEC-07, AUTH-09: inside an outer transaction (the idempotency gate's), each <c>InTransactionAsync</c> attempt runs in
/// its own savepoint, so a failed attempt leaves nothing behind and a retry starts clean.
/// </summary>
public sealed class CspsUnitOfWorkTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 15, 12, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AFailedAttemptInsideAnOuterTransactionRollsBackEverythingItWrote()
    {
        var keyA = Guid.NewGuid();
        var keyB = Guid.NewGuid();
        await using var context = database.CreateContext();
        var unitOfWork = new CspsUnitOfWork(context);
        var original = await ReadContactPhoneAsync(database);
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await Should.ThrowAsync<ConcurrencyConflictException>(() => unitOfWork.InTransactionAsync<int>(
                async cancellationToken =>
                {
                    var settings = await context.SiteSettings.SingleAsync(cancellationToken);
                    context.IdempotencyRecords.Add(NewRecord(keyA));
                    await unitOfWork.SaveChangesAsync(cancellationToken);

                    // A competing write on the same connection moves the row version under the tracked entity.
                    await context.Database.ExecuteSqlRawAsync("UPDATE SiteSettings SET ContactPhone = N'changed by the attempt'", cancellationToken);
                    context.Entry(settings).Property(s => s.BusinessName).CurrentValue = "Lost the race";
                    return await unitOfWork.SaveChangesAsync(cancellationToken);
                },
                TestContext.Current.CancellationToken));

            (await context.IdempotencyRecords.AsNoTracking().AnyAsync(r => r.Key == keyA, TestContext.Current.CancellationToken)).ShouldBeFalse();
            (await context.SiteSettings.AsNoTracking().Select(s => s.ContactPhone).SingleAsync(TestContext.Current.CancellationToken)).ShouldBe(original);

            await unitOfWork.InTransactionAsync(
                async cancellationToken =>
                {
                    context.IdempotencyRecords.Add(NewRecord(keyB));
                    return await unitOfWork.SaveChangesAsync(cancellationToken);
                },
                TestContext.Current.CancellationToken);

            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }

        await using var fresh = database.CreateContext();
        (await fresh.IdempotencyRecords.AsNoTracking().AnyAsync(r => r.Key == keyA, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await fresh.IdempotencyRecords.AsNoTracking().AnyAsync(r => r.Key == keyB, TestContext.Current.CancellationToken)).ShouldBeTrue();
    }

    [Fact]
    public async Task NestedAttemptsRollBackIndependently()
    {
        var keyMiddle = Guid.NewGuid();
        var keyInner = Guid.NewGuid();
        await using var context = database.CreateContext();
        var unitOfWork = new CspsUnitOfWork(context);
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await unitOfWork.InTransactionAsync(
                async cancellationToken =>
                {
                    context.IdempotencyRecords.Add(NewRecord(keyMiddle));
                    await unitOfWork.SaveChangesAsync(cancellationToken);

                    try
                    {
                        await unitOfWork.InTransactionAsync<int>(
                            async innerToken =>
                            {
                                context.IdempotencyRecords.Add(NewRecord(keyInner));
                                await unitOfWork.SaveChangesAsync(innerToken);
                                throw new InvalidOperationException("The inner attempt failed.");
                            },
                            cancellationToken);
                    }
                    catch (InvalidOperationException)
                    {
                        // The middle attempt carries on after the inner one is undone.
                    }

                    return 0;
                },
                TestContext.Current.CancellationToken);

            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }

        await using var fresh = database.CreateContext();
        (await fresh.IdempotencyRecords.AsNoTracking().AnyAsync(r => r.Key == keyMiddle, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await fresh.IdempotencyRecords.AsNoTracking().AnyAsync(r => r.Key == keyInner, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    private static async Task<string> ReadContactPhoneAsync(CspsDatabase database)
    {
        await using var context = database.CreateContext();
        return await context.SiteSettings.AsNoTracking().Select(s => s.ContactPhone).SingleAsync(TestContext.Current.CancellationToken);
    }

    private static IdempotencyRecord NewRecord(Guid key) =>
        IdempotencyRecord.Create(key, null, "POST /api/v1/test", new byte[32], 200, null, null, null, Now);
}
