using Csps.Domain.Content;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Content;

/// <summary>
/// PUB-03, CONT-05: the public cache is cleared after a committed save of a public record, never before the commit and never on a
/// rollback or a failed save. Each test reads the snapshot once (to fill the cache), changes data through the host's own context (so
/// its interceptors run), and then reads again, counting SQL commands: zero commands means the cached value was served.
/// </summary>
public sealed class PublicContentInvalidationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Later = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task ACommittedSaveClearsTheCacheSoTheNextReadShowsTheNewValue()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var services = PublicContentServices.Build(database.ConnectionString);
        var before = await PublicContentServices.ReadAsync(services);

        await using (var scope = services.CreateAsyncScope())
        {
            await PublicContentSeeding.SaveAsync(scope.ServiceProvider.GetRequiredService<CspsDbContext>(), PublicContentSeeding.Demo("Second line"), Later);
        }

        var after = await PublicContentServices.ReadAsync(services);
        before.Site.Tagline.ShouldBe("First line");
        after.Site.Tagline.ShouldBe("Second line");
        after.Json.ETag.ShouldNotBe(before.Json.ETag);
    }

    [Fact]
    public async Task AddingAPhoneAloneClearsTheCache()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var services = PublicContentServices.Build(database.ConnectionString);
        (await PublicContentServices.ReadAsync(services)).Site.Phones.Count.ShouldBe(2);

        await using (var scope = services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            context.SitePhoneNumbers.Add(SitePhoneNumber.Create("0918 123 4567", "Smart", isMain: false, position: 2, Later).Value);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        (await PublicContentServices.ReadAsync(services)).Site.Phones.Select(phone => phone.Label).ShouldBe(["Globe", null, "Smart"]);
    }

    [Fact]
    public async Task RemovingAPhoneClearsTheCache()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var services = PublicContentServices.Build(database.ConnectionString);
        (await PublicContentServices.ReadAsync(services)).Site.Phones.Count.ShouldBe(2);

        await using (var scope = services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            context.SitePhoneNumbers.Remove(await context.SitePhoneNumbers.SingleAsync(phone => !phone.IsMain, TestContext.Current.CancellationToken));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        (await PublicContentServices.ReadAsync(services)).Site.Phones.Count.ShouldBe(1);
    }

    [Fact]
    public async Task ASaveInsideATransactionClearsTheCacheOnlyAfterTheCommit()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        var counter = new CommandCounter();
        await using var services = PublicContentServices.Build(database.ConnectionString, counter);
        await PublicContentServices.ReadAsync(services);

        await using var scope = services.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("Second line"), Later);

            // Saved but not committed: the old value is still served, from the cache, with no SQL command.
            counter.Reset();
            var during = await PublicContentServices.ReadAsync(services);
            counter.Count.ShouldBe(0);
            during.Site.Tagline.ShouldBe("First line");

            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }

        (await PublicContentServices.ReadAsync(services)).Site.Tagline.ShouldBe("Second line");
    }

    [Fact]
    public async Task ARolledBackTransactionClearsNothing()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        var counter = new CommandCounter();
        await using var services = PublicContentServices.Build(database.ConnectionString, counter);
        var before = await PublicContentServices.ReadAsync(services);

        await using (var scope = services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
            await using (transaction)
            {
                await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("Second line"), Later);
                await transaction.RollbackAsync(TestContext.Current.CancellationToken);
            }
        }

        counter.Reset();
        var after = await PublicContentServices.ReadAsync(services);

        counter.Count.ShouldBe(0, "a rolled-back change must not clear the cache");
        after.Site.Tagline.ShouldBe("First line");
        after.ShouldBeSameAs(before);
    }

    [Fact]
    public async Task AFailedSaveClearsNothing()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        var counter = new CommandCounter();
        await using var services = PublicContentServices.Build(database.ConnectionString, counter);
        await PublicContentServices.ReadAsync(services);

        await using (var scope = services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();

            // The same number twice breaks the unique index, so the whole save fails.
            context.SitePhoneNumbers.Add(SitePhoneNumber.Create("0919 123 4567", null, isMain: false, position: 2, Later).Value);
            context.SitePhoneNumbers.Add(SitePhoneNumber.Create("0919 123 4567", null, isMain: false, position: 3, Later).Value);
            await Should.ThrowAsync<DbUpdateException>(() => context.SaveChangesAsync(TestContext.Current.CancellationToken));
        }

        counter.Reset();
        await PublicContentServices.ReadAsync(services);

        counter.Count.ShouldBe(0, "a failed save must not clear the cache");
    }

    [Fact]
    public async Task ASaveOfARecordThatIsNotPublicClearsNothing()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        var counter = new CommandCounter();
        await using var services = PublicContentServices.Build(database.ConnectionString, counter);
        await PublicContentServices.ReadAsync(services);

        await using (var scope = services.CreateAsyncScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            context.ExpenseCategories.Add(ExpenseCategory.Create($"Cache probe {Guid.NewGuid():N}"[..30], CategoryTones.Info, Later).Value);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        counter.Reset();
        await PublicContentServices.ReadAsync(services);

        counter.Count.ShouldBe(0);
    }

    [Fact]
    public async Task ASaveWorksWhenNoPublicCacheIsRegistered()
    {
        var services = new ServiceCollection();
        services.AddCspsPersistence(database.ConnectionString);
        await using var provider = services.BuildServiceProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();

        await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo("Saved with no cache"), Later);

        (await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken)).Tagline.ShouldBe("Saved with no cache");
    }
}
