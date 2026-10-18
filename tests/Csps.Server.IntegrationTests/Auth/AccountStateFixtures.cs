using Csps.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>Puts a test account into a Phase 5 state (Manager lock, soft delete) through UserManager.</summary>
internal static class AccountStateFixtures
{
    /// <summary>Locks an account as a Manager would (D-16), separate from the failed-password lockout.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the lock is saved.</returns>
    public static Task ManagerLockAsync(WebApplicationFactory<Program> factory, Guid id) =>
        ChangeAsync(factory, id, user => user.ManagerLockedAtUtc = TimeProvider.System.GetUtcNow());

    /// <summary>Marks an account deleted (D-07).</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="id">The account id.</param>
    /// <returns>A task that completes when the mark is saved.</returns>
    public static Task MarkDeletedAsync(WebApplicationFactory<Program> factory, Guid id) =>
        ChangeAsync(factory, id, user => user.DeletedAtUtc = TimeProvider.System.GetUtcNow());

    private static async Task ChangeAsync(WebApplicationFactory<Program> factory, Guid id, Action<ApplicationUser> change)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByIdAsync(id.ToString("D"))).ShouldNotBeNull();
            change(user);
            (await users.UpdateAsync(user)).Succeeded.ShouldBeTrue();
        }
    }
}
