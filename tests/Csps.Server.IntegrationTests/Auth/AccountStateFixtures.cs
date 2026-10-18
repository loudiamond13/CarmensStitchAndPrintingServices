using Csps.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>Puts a test account into a Phase 5 state (Manager lock, soft delete) by writing the column directly.</summary>
internal static class AccountStateFixtures
{
    /// <summary>Locks an account as a Manager would (D-16), separate from the failed-password lockout.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the lock is saved.</returns>
    public static async Task ManagerLockAsync(WebApplicationFactory<Program> factory, Guid id)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            var changed = await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE AspNetUsers SET ManagerLockedAtUtc = SYSDATETIMEOFFSET() WHERE Id = {id}", TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }
    }

    /// <summary>Marks an account deleted (D-07).</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the mark is saved.</returns>
    public static async Task MarkDeletedAsync(WebApplicationFactory<Program> factory, Guid id)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            var changed = await context.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE AspNetUsers SET DeletedAtUtc = SYSDATETIMEOFFSET() WHERE Id = {id}", TestContext.Current.CancellationToken);
            changed.ShouldBe(1);
        }
    }
}
