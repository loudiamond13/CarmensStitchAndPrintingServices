using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Fixture;

/// <summary>The per-class database fixture: guarded name, pinned compatibility level, dropped on dispose (FND-11).</summary>
public sealed class CspsDatabaseTests
{
    [Fact]
    public async Task CreatesAGuardedDatabasePinnedToTheCompatibilityLevelAndDropsItOnDispose()
    {
        var server = await SqlServerInstance.GetSharedAsync();
        var database = await CspsDatabase.CreateAsync();
        string name;
        try
        {
            name = database.DatabaseName;
            TestDatabaseName.IsDisposable(name).ShouldBeTrue();
            (await ScalarAsync<byte>(server, $"SELECT compatibility_level FROM sys.databases WHERE name = N'{name}';"))
                .ShouldBe((byte)SqlCompatibility.Level);
        }
        finally
        {
            await database.DisposeAsync();
        }

        (await ScalarAsync<int>(server, $"SELECT COUNT(*) FROM sys.databases WHERE name = N'{name}';")).ShouldBe(0);
    }

    private static async Task<T> ScalarAsync<T>(SqlServerInstance server, string sql)
    {
        var connection = new SqlConnection(server.MasterConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return (T)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }
}
