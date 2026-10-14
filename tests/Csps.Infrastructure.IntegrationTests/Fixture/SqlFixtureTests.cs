using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Fixture;

/// <summary>
/// FND-11, D-05, D-07: test databases are isolated from each other when created concurrently, are dropped on
/// dispose, and can be reset between tests with Respawn without losing the migration history or the
/// migration-seeded SiteSettings row.
/// </summary>
public sealed class SqlFixtureTests
{
    [Fact]
    public async Task ConcurrentDatabasesAreDistinctAndMigrated()
    {
        var first = CspsDatabase.CreateAsync();
        var second = CspsDatabase.CreateAsync();
        CspsDatabase[] databases;
        try
        {
            databases = await Task.WhenAll(first, second);
        }
        catch
        {
            await DisposeCompletedAsync(first, second);
            throw;
        }

        string[] names = [databases[0].DatabaseName, databases[1].DatabaseName];
        try
        {
            names[0].ShouldNotBe(names[1]);
            names.ShouldAllBe(name => TestDatabaseName.IsDisposable(name));

            foreach (var database in databases)
            {
                (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.SiteSettings;")).ShouldBe(1);
                (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.__EFMigrationsHistory;")).ShouldBeGreaterThan(0);
            }
        }
        finally
        {
            await databases[0].DisposeAsync();
            await databases[1].DisposeAsync();
        }

        var server = await SqlServerInstance.GetSharedAsync();
        foreach (var name in names)
        {
            (await CountAsync(server.MasterConnectionString, $"SELECT COUNT(*) FROM sys.databases WHERE name = N'{name}';"))
                .ShouldBe(0, $"{name} must be dropped on dispose.");
        }
    }

    [Fact]
    public async Task ResetClearsUserTablesKeepsHistoryAndSettings()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var historyBefore = await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.__EFMigrationsHistory;");
            await ExecuteAsync(
                database.ConnectionString,
                "CREATE TABLE dbo.RespawnProbe (Id int NOT NULL PRIMARY KEY); INSERT INTO dbo.RespawnProbe (Id) VALUES (1), (2);");

            await database.ResetAsync();

            (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.RespawnProbe;")).ShouldBe(0);
            (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.__EFMigrationsHistory;")).ShouldBe(historyBefore);
            (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.SiteSettings;")).ShouldBe(1);

            // A second reset reuses the same Respawner.
            await ExecuteAsync(database.ConnectionString, "INSERT INTO dbo.RespawnProbe (Id) VALUES (3);");
            await database.ResetAsync();
            (await CountAsync(database.ConnectionString, "SELECT COUNT(*) FROM dbo.RespawnProbe;")).ShouldBe(0);
        }
    }

    private static async Task DisposeCompletedAsync(params Task<CspsDatabase>[] tasks)
    {
        foreach (var task in tasks)
        {
            if (task.IsCompletedSuccessfully)
            {
                await task.Result.DisposeAsync();
            }
        }
    }

    private static async Task<int> CountAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static async Task ExecuteAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }
}
