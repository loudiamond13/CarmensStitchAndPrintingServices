using Csps.Application.Security;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// AUTH-01: staff accounts live on Identity (schema version 2) in the migrated database, and the two roles ship
/// with the migration itself (D-08), not from a seed.
/// </summary>
public sealed class IdentitySchemaTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task MigrationSeedsTheRole(string role)
    {
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole<Guid>>>();

        var found = await roles.FindByNameAsync(role);

        found.ShouldNotBeNull();
        found.Name.ShouldBe(role);
    }

    [Fact]
    public async Task ManagerIsFoundByEmailInAnyLetterCaseWithTheSeededRole()
    {
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var email = $"paolo.{Guid.NewGuid():N}@gmail.com";
        var user = new ApplicationUser
        {
            UserName = email,
            Email = email,
            EmailConfirmed = true,
            FirstName = "Paolo",
            LastName = "Garcia",
        };

        (await users.CreateAsync(user)).Succeeded.ShouldBeTrue();
        (await users.AddToRoleAsync(user, Roles.Manager)).Succeeded.ShouldBeTrue();

        var found = await users.FindByEmailAsync(email.ToUpperInvariant());

        found.ShouldNotBeNull();
        found.Id.ShouldBe(user.Id);
        found.FirstName.ShouldBe("Paolo");
        found.LastName.ShouldBe("Garcia");
        found.IsActive.ShouldBeTrue();
        found.MustChangePassword.ShouldBeFalse();
        found.MustChangePasswordReason.ShouldBeNull();
        found.BreachRecheckPending.ShouldBeFalse();
        (await users.GetRolesAsync(found)).ShouldBe([Roles.Manager]);
    }

    private ServiceProvider BuildProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsIdentity();
        return services.BuildServiceProvider(validateScopes: true);
    }
}
