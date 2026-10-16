using Csps.Application.Security;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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

    [Fact]
    public async Task AnInactiveAccountIsInsertedAsInactiveNotAsTheColumnDefault()
    {
        var normalized = $"INACTIVE.{Guid.NewGuid():N}@EXAMPLE.COM".ToUpperInvariant();
        await using (var writer = database.CreateContext())
        {
            var user = NewRawUser("inactive", normalized);
            user.IsActive = false;
            writer.Users.Add(user);
            await writer.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var reader = database.CreateContext();
        var found = await reader.Users.AsNoTracking().SingleAsync(user => user.NormalizedEmail == normalized, TestContext.Current.CancellationToken);
        found.IsActive.ShouldBeFalse();
    }

    [Fact]
    public async Task TwoUsersCannotShareANormalizedEmailEvenWhenTheyRacePastTheManagerCheck()
    {
        var normalized = $"RACE.{Guid.NewGuid():N}@EXAMPLE.COM".ToUpperInvariant();
        var first = database.CreateContext();
        var second = database.CreateContext();
        await using (first)
        await using (second)
        {
            // Raw inserts skip UserManager's RequireUniqueEmail check, as two concurrent creates would.
            first.Users.Add(NewRawUser("first", normalized));
            second.Users.Add(NewRawUser("second", normalized));

            await first.SaveChangesAsync(TestContext.Current.CancellationToken);
            var error = await Should.ThrowAsync<DbUpdateException>(() => second.SaveChangesAsync(TestContext.Current.CancellationToken));

            error.InnerException!.Message.ShouldContain("EmailIndex");
        }
    }

    [Fact]
    public async Task ResetKeepsTheMigrationRolesAndRemovesUsers()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            var context = own.CreateContext();
            await using (context)
            {
                context.Users.Add(NewRawUser("gone", $"GONE.{Guid.NewGuid():N}@EXAMPLE.COM"));
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            await own.ResetAsync();

            var after = own.CreateContext();
            await using (after)
            {
                (await after.Users.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
                (await after.Roles.Select(role => role.Name).OrderBy(name => name).ToListAsync(TestContext.Current.CancellationToken))
                    .ShouldBe([Roles.Admin, Roles.Manager]);
            }
        }
    }

    [Fact]
    public async Task HostBuiltModelMatchesTheMigrations()
    {
        await using var provider = BuildProvider();
        await using var scope = provider.CreateAsyncScope();
        var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();

        context.Database.HasPendingModelChanges().ShouldBeFalse("The model Identity builds inside the host must match the migrations.");
    }

    private static ApplicationUser NewRawUser(string name, string normalizedEmail) => new()
    {
        Id = Guid.NewGuid(),
        UserName = $"{name}.{Guid.NewGuid():N}",
        NormalizedUserName = $"{name}.{Guid.NewGuid():N}".ToUpperInvariant(),
        Email = normalizedEmail.ToLowerInvariant(),
        NormalizedEmail = normalizedEmail,
        FirstName = "Test",
        LastName = "User",
    };

    private ServiceProvider BuildProvider()
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsIdentity();
        return services.BuildServiceProvider(validateScopes: true);
    }
}
