using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Metadata;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// FND-12, FND-01, D-13: the migrations are safe to ship. Every migration applies on top of its predecessor,
/// the idempotent production script applies twice at both candidate compatibility levels, the model has no
/// unmigrated change and nothing is mapped to JSON. Each test uses its own database.
/// </summary>
public sealed partial class MigrationScriptTests
{
    [Fact]
    public async Task EachMigrationAppliesOnTopOfItsPredecessor()
    {
        var migrations = AllMigrations();
        migrations.ShouldNotBeEmpty();

        for (var index = 0; index < migrations.Count; index++)
        {
            var database = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
            await using (database)
            {
                var context = database.CreateContext();
                await using (context)
                {
                    var migrator = context.GetService<IMigrator>();
                    if (index > 0)
                    {
                        await migrator.MigrateAsync(migrations[index - 1], TestContext.Current.CancellationToken);
                    }

                    await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);

                    (await context.Database.GetAppliedMigrationsAsync(TestContext.Current.CancellationToken))
                        .ShouldBe(migrations, $"Starting from {(index == 0 ? "an empty database" : migrations[index - 1])}.");
                }
            }
        }
    }

    [Theory]
    [InlineData(SqlCompatibility.Level)]
    [InlineData(170)]
    public async Task IdempotentScriptAppliesTwice(int compatibilityLevel)
    {
        var database = await CspsDatabase.CreateEmptyAsync(compatibilityLevel);
        await using (database)
        {
            string script;
            var context = database.CreateContext();
            await using (context)
            {
                script = context.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
            }

            var connection = new SqlConnection(database.ConnectionString);
            await using (connection)
            {
                await connection.OpenAsync(TestContext.Current.CancellationToken);
                (await ScalarAsync<byte>(connection, "SELECT compatibility_level FROM sys.databases WHERE name = DB_NAME();"))
                    .ShouldBe((byte)compatibilityLevel);

                await ApplyScriptAsync(connection, script);
                var historyAfterFirst = await ReadHistoryAsync(connection);
                var rowVersionAfterFirst = await ScalarAsync<byte[]>(connection, "SELECT RowVersion FROM dbo.SiteSettings WHERE Id = 1;");

                await ApplyScriptAsync(connection, script);

                historyAfterFirst.ShouldBe(AllMigrations());
                (await ReadHistoryAsync(connection)).ShouldBe(historyAfterFirst, "The second run must add no history row.");
                (await ScalarAsync<int>(connection, "SELECT COUNT(*) FROM dbo.SiteSettings;")).ShouldBe(1);
                (await ScalarAsync<byte[]>(connection, "SELECT RowVersion FROM dbo.SiteSettings WHERE Id = 1;"))
                    .ShouldBe(rowVersionAfterFirst, "The second run must not touch the seeded row.");
            }
        }
    }

    [Fact]
    public void IdempotentScriptWrapsEachMigrationInItsOwnTransaction()
    {
        // FND-12 concurrency edge (backstop): an interrupted apply stops at the last committed migration.
        var context = CreateUnopenedContext();
        using (context)
        {
            var script = context.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);

            BeginTransaction().Count(script).ShouldBe(AllMigrations().Count);
            Commit().Count(script).ShouldBe(AllMigrations().Count);
        }
    }

    [Fact]
    public void ModelHasNoPendingChanges()
    {
        var context = CreateUnopenedContext();
        using (context)
        {
            context.Database.HasPendingModelChanges().ShouldBeFalse("A model change has no migration. Run dotnet ef migrations add.");
        }
    }

    [Fact]
    public void IdempotentScriptHasNoPasskeyTable()
    {
        // Identity schema version 3 adds AspNetUserPasskeys with a JSON column (D-13 of Phase 1, T-04-25).
        var context = CreateUnopenedContext();
        using (context)
        {
            var script = context.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);

            script.ShouldContain("AspNetUsers", Case.Sensitive, "The Identity tables must be in the script.");
            script.ShouldNotContain("AspNetUserPasskeys", Case.Insensitive);
        }
    }

    [Fact]
    public void ModelHasNoJsonMappings()
    {
        var context = CreateUnopenedContext();
        using (context)
        {
            var model = context.GetService<IDesignTimeModel>().Model;
            var offenders = new List<string>();

            foreach (var entityType in model.GetEntityTypes())
            {
                if (entityType.IsMappedToJson())
                {
                    offenders.Add($"{entityType.DisplayName()} is mapped to JSON");
                }

                offenders.AddRange(entityType.GetProperties()
                    .Where(property => property.IsPrimitiveCollection)
                    .Select(property => $"{entityType.DisplayName()}.{property.Name} is a primitive collection (stored as JSON)"));

                offenders.AddRange(entityType.GetComplexProperties()
                    .Where(complex => complex.ComplexType.IsMappedToJson())
                    .Select(complex => $"{entityType.DisplayName()}.{complex.Name} is a complex type mapped to JSON"));
            }

            offenders.ShouldBeEmpty("D-13: no JSON columns anywhere.");

            var script = context.GetService<IMigrator>().GenerateScript(options: MigrationsSqlGenerationOptions.Idempotent);
            JsonWord().IsMatch(script).ShouldBeFalse("The migration script must not mention a json type.");
        }
    }

    private static List<string> AllMigrations()
    {
        var context = CreateUnopenedContext();
        using (context)
        {
            return [.. context.Database.GetMigrations()];
        }
    }

    // A context on a database name that is never created: these tests read the model and generate SQL only.
    private static CspsDbContext CreateUnopenedContext()
    {
        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(
            builder,
            new SqlConnectionStringBuilder(SqlServerInstance.LocalDbMasterConnectionString) { InitialCatalog = TestDatabaseName.NewName() }.ConnectionString);
        return new CspsDbContext(builder.Options);
    }

    private static async Task ApplyScriptAsync(SqlConnection connection, string script)
    {
        foreach (var batch in GoSeparator().Split(script))
        {
            if (string.IsNullOrWhiteSpace(batch))
            {
                continue;
            }

            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = batch;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private static async Task<List<string>> ReadHistoryAsync(SqlConnection connection)
    {
        var history = new List<string>();
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = "SELECT MigrationId FROM dbo.__EFMigrationsHistory ORDER BY MigrationId;";
            var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
            await using (reader)
            {
                while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                {
                    history.Add(reader.GetString(0));
                }
            }
        }

        return history;
    }

    private static async Task<T> ScalarAsync<T>(SqlConnection connection, string sql)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = sql;
            return (T)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        }
    }

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex GoSeparator();

    [GeneratedRegex(@"^\s*BEGIN TRANSACTION;\s*$", RegexOptions.Multiline | RegexOptions.CultureInvariant)]
    private static partial Regex BeginTransaction();

    [GeneratedRegex(@"^\s*COMMIT;\s*$", RegexOptions.Multiline | RegexOptions.CultureInvariant)]
    private static partial Regex Commit();

    [GeneratedRegex(@"\bjson\b", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex JsonWord();
}
