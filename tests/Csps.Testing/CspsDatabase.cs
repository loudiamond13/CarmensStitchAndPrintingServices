using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Csps.Testing;

/// <summary>
/// One throwaway database per test class (<c>IClassFixture&lt;CspsDatabase&gt;</c>), or per test through
/// <see cref="CreateAsync"/>. It is named <c>CSPS_Test_&lt;guid&gt;</c>, pinned to
/// <see cref="SqlCompatibility.Level"/>, given its schema by the real EF migrations (never <c>EnsureCreated</c>,
/// because the migrations are under test) and dropped on dispose, only after <see cref="TestDatabaseName.IsDisposable"/>
/// confirms the name.
/// </summary>
public sealed class CspsDatabase : IAsyncLifetime
{
    private SqlServerInstance? _server;

    /// <summary>The generated database name, <c>CSPS_Test_&lt;lowercase guid&gt;</c>.</summary>
    public string DatabaseName { get; } = TestDatabaseName.NewName();

    /// <summary>Connection string of this database. Empty until <see cref="InitializeAsync"/> has run.</summary>
    public string ConnectionString { get; private set; } = string.Empty;

    /// <summary>Creates, migrates and returns an ad-hoc database. The caller disposes it.</summary>
    /// <returns>The ready database.</returns>
    public static async Task<CspsDatabase> CreateAsync()
    {
        var database = new CspsDatabase();
        try
        {
            await database.InitializeAsync().ConfigureAwait(false);
            return database;
        }
        catch
        {
            await database.DisposeAsync().ConfigureAwait(false);
            throw;
        }
    }

    /// <summary>Creates the database, pins its compatibility level and applies every migration.</summary>
    /// <returns>A task that completes when the schema is in place.</returns>
    public async ValueTask InitializeAsync()
    {
        _server = await SqlServerInstance.GetSharedAsync().ConfigureAwait(false);
        var quoted = QuotedName();

        await ExecuteOnMasterAsync($"CREATE DATABASE {quoted};").ConfigureAwait(false);
        await ExecuteOnMasterAsync($"ALTER DATABASE {quoted} SET COMPATIBILITY_LEVEL = {SqlCompatibility.Level};").ConfigureAwait(false);

        ConnectionString = _server.ConnectionStringFor(DatabaseName);

        var context = CreateContext();
        await using (context.ConfigureAwait(false))
        {
            await context.Database.MigrateAsync().ConfigureAwait(false);
        }
    }

    /// <summary>Creates a new context on this database. The caller disposes it.</summary>
    /// <returns>A context built through <see cref="CspsDbContextOptions.Configure"/>.</returns>
    public CspsDbContext CreateContext()
    {
        if (string.IsNullOrEmpty(ConnectionString))
        {
            throw new InvalidOperationException("The test database is not initialized yet.");
        }

        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, ConnectionString);
        return new CspsDbContext(builder.Options);
    }

    /// <summary>Drops the database (only a <c>CSPS_Test_&lt;guid&gt;</c> name, re-checked here).</summary>
    /// <returns>A task that completes when the database is gone.</returns>
    public async ValueTask DisposeAsync()
    {
        if (_server is null)
        {
            return;
        }

        SqlConnection.ClearAllPools();
        var quoted = QuotedName();
        await ExecuteOnMasterAsync(
            $"IF DB_ID(N'{DatabaseName}') IS NOT NULL BEGIN ALTER DATABASE {quoted} SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE {quoted}; END;")
            .ConfigureAwait(false);
    }

    // Every DDL statement goes through here, so the name is re-validated before it reaches SQL (CWE-89).
    private string QuotedName()
    {
        if (!TestDatabaseName.IsDisposable(DatabaseName))
        {
            throw new InvalidOperationException(
                $"Refusing to touch database '{DatabaseName}': only names matching ^CSPS_Test_[0-9a-f-]{{36}}$ are allowed.");
        }

        return "[" + DatabaseName + "]";
    }

    private async Task ExecuteOnMasterAsync(string sql)
    {
        var connection = new SqlConnection(_server!.MasterConnectionString);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync().ConfigureAwait(false);
            var command = connection.CreateCommand();
            await using (command.ConfigureAwait(false))
            {
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync().ConfigureAwait(false);
            }
        }
    }
}
