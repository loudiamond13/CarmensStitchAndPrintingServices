using Csps.Domain.Auditing;
using Csps.Infrastructure.Auditing;
using Csps.Infrastructure.IntegrationTests.Auditing;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// The persistence registration serves both a context factory (short-lived contexts for caches and independent
/// audit writes) and a scoped context (handlers and Identity stores), and every context carries the same interceptors.
/// </summary>
public sealed class ContextFactoryRegistrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ResolvesTheFactoryAndAScopedContext()
    {
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(), new FixedRequestContext());
        await using (provider)
        {
            provider.GetRequiredService<IDbContextFactory<CspsDbContext>>().ShouldNotBeNull();

            var scope = provider.CreateAsyncScope();
            await using (scope)
            {
                scope.ServiceProvider.GetRequiredService<CspsDbContext>().ShouldNotBeNull();
            }
        }
    }

    [Fact]
    public async Task FactoryContextsCarryTheAppendOnlyInterceptor()
    {
        var provider = AuditLogSql.BuildProvider(database, new FakeTimeProvider(), new FixedRequestContext());
        await using (provider)
        {
            var context = await provider.GetRequiredService<IDbContextFactory<CspsDbContext>>()
                .CreateDbContextAsync(TestContext.Current.CancellationToken);
            await using (context)
            {
                var entry = AuditEntry.Create(
                    TimeProvider.System.GetUtcNow(), null, "system.check", null, null, null, null, Guid.NewGuid().ToString("N"), null);
                context.AuditLog.Add(entry);
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);

                context.AuditLog.Remove(entry);

                var error = await Should.ThrowAsync<InvalidOperationException>(
                    () => context.SaveChangesAsync(TestContext.Current.CancellationToken));
                error.Message.ShouldBe(AuditLogAppendOnlyInterceptor.Message);
            }
        }
    }
}
