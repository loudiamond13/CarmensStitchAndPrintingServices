using Csps.Application.Security;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
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

    [Theory]
    [InlineData("EditVersion", "uniqueidentifier", false, 0)]
    [InlineData("CreatedById", "uniqueidentifier", true, 0)]
    [InlineData("CreatedAtUtc", "datetimeoffset", false, 0)]
    [InlineData("UpdatedById", "uniqueidentifier", true, 0)]
    [InlineData("UpdatedAtUtc", "datetimeoffset", true, 0)]
    [InlineData("ManagerLockedAtUtc", "datetimeoffset", true, 0)]
    [InlineData("DeletedAtUtc", "datetimeoffset", true, 0)]
    [InlineData("PendingEmail", "nvarchar", true, 256)]
    public async Task UserManagementColumnsHaveTheirTypeNullabilityAndLength(string column, string type, bool nullable, int length)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    """
                    SELECT t.name, c.is_nullable, c.max_length
                    FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                    WHERE c.object_id = OBJECT_ID(N'dbo.AspNetUsers') AND c.name = @column;
                    """;
                command.Parameters.AddWithValue("@column", column);
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue($"{column} must exist.");
                    reader.GetString(0).ShouldBe(type);
                    reader.GetBoolean(1).ShouldBe(nullable);
                    if (length > 0)
                    {
                        (reader.GetInt16(2) / 2).ShouldBe(length);
                    }
                }
            }
        }
    }

    [Fact]
    public async Task AttributionKeysAreIndexedNoActionKeysToTheUserTableAndTheVersionDefaultsToNewId()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);

            var actions = await ReadColumnAsync<string>(
                connection,
                """
                SELECT CAST(pc.name AS nvarchar(128)) + N':' + CAST(fk.delete_referential_action_desc AS nvarchar(60)) COLLATE DATABASE_DEFAULT
                FROM sys.foreign_keys fk
                JOIN sys.foreign_key_columns fkc ON fkc.constraint_object_id = fk.object_id
                JOIN sys.columns pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
                WHERE fk.parent_object_id = OBJECT_ID(N'dbo.AspNetUsers') AND fk.referenced_object_id = OBJECT_ID(N'dbo.AspNetUsers')
                ORDER BY pc.name;
                """);
            actions.ShouldBe(["CreatedById:NO_ACTION", "UpdatedById:NO_ACTION"]);

            var indexed = await ReadColumnAsync<string>(
                connection,
                """
                SELECT c.name
                FROM sys.index_columns ic
                JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                WHERE ic.object_id = OBJECT_ID(N'dbo.AspNetUsers') AND ic.key_ordinal = 1 AND c.name IN (N'CreatedById', N'UpdatedById')
                ORDER BY c.name;
                """);
            indexed.ShouldBe(["CreatedById", "UpdatedById"]);

            var defaults = await ReadColumnAsync<string>(
                connection,
                """
                SELECT dc.definition
                FROM sys.default_constraints dc JOIN sys.columns c ON c.object_id = dc.parent_object_id AND c.column_id = dc.parent_column_id
                WHERE dc.parent_object_id = OBJECT_ID(N'dbo.AspNetUsers') AND c.name = N'EditVersion';
                """);
            defaults.ShouldHaveSingleItem().ShouldContain("newid()", Case.Insensitive);
        }
    }

    [Fact]
    public async Task NoColumnOfTheUserTableIsAJsonType()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);

            var json = await ReadColumnAsync<string>(
                connection,
                """
                SELECT c.name
                FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
                WHERE c.object_id = OBJECT_ID(N'dbo.AspNetUsers') AND t.name = N'json';
                """);

            json.ShouldBeEmpty();
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

    private static async Task<List<T>> ReadColumnAsync<T>(SqlConnection connection, string sql)
    {
        var values = new List<T>();
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = sql;
            var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            await using (reader)
            {
                while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                {
                    values.Add(reader.GetFieldValue<T>(0));
                }
            }
        }

        return values;
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
