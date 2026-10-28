using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Respawn;
using Respawn.Graph;
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
    private const int MinCompatibilityLevel = 100;
    private const int MaxCompatibilityLevel = 170;

    // Never reset: migration history, the migration-seeded SiteSettings row, AspNetRoles and the DatabaseLocks standing rows
    // (Pitfall 7), and the append-only audit log with its empty truncate guard (the trigger rejects Respawn's DELETE, research Pitfall 1).
    private static readonly string[] IgnoredTables = ["__EFMigrationsHistory", "SiteSettings", "AspNetRoles", "DatabaseLocks", "AuditLog", "AuditLogTruncateGuard"];

    private SqlServerInstance? _server;
    private Respawner? _respawner;

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

    /// <summary>
    /// Creates an ad-hoc, empty database (no migrations applied) at the given compatibility level, for tests
    /// that apply the schema themselves, such as the idempotent-script tests (FND-12). The caller disposes it.
    /// </summary>
    /// <param name="compatibilityLevel">A SQL Server compatibility level, 100 to 170.</param>
    /// <returns>The empty database.</returns>
    public static async Task<CspsDatabase> CreateEmptyAsync(int compatibilityLevel)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(compatibilityLevel, MinCompatibilityLevel);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(compatibilityLevel, MaxCompatibilityLevel);

        var database = new CspsDatabase();
        try
        {
            await database.CreateDatabaseAsync(compatibilityLevel).ConfigureAwait(false);
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
        await CreateDatabaseAsync(SqlCompatibility.Level).ConfigureAwait(false);

        var context = CreateContext();
        await using (context.ConfigureAwait(false))
        {
            await context.Database.MigrateAsync().ConfigureAwait(false);
        }
    }

    /// <summary>
    /// Deletes the rows of every user table with Respawn, except the migration history, the migration-seeded roles and the migration-seeded
    /// SiteSettings row (research Pattern 11). The Respawner is built on first use, so tables a test created
    /// before its first reset are included. Respawn deletes with DELETE, which the append-only trigger rejects, so
    /// AuditLog and its AuditLogTruncateGuard are never reset (research Pitfall 1). Audit tests therefore find their
    /// own rows by a unique correlation id. When every user table is on the ignore list there is nothing to reset, and
    /// the call returns without building the Respawner (Respawn itself would throw "No tables found").
    /// </summary>
    /// <returns>A task that completes when the data is gone.</returns>
    public async Task ResetAsync()
    {
        if (string.IsNullOrEmpty(ConnectionString))
        {
            throw new InvalidOperationException("The test database is not initialized yet.");
        }

        var connection = new SqlConnection(ConnectionString);
        await using (connection.ConfigureAwait(false))
        {
            await connection.OpenAsync().ConfigureAwait(false);
            if (_respawner is null && !await HasResettableTableAsync(connection).ConfigureAwait(false))
            {
                return;
            }

            _respawner ??= await Respawner.CreateAsync(
                connection,
                new RespawnerOptions
                {
                    DbAdapter = DbAdapter.SqlServer,
                    TablesToIgnore = [.. IgnoredTables.Select(name => new Table(name))],
                }).ConfigureAwait(false);

            await _respawner.ResetAsync(connection).ConfigureAwait(false);
        }

        await ReseedExpenseCategoriesAsync().ConfigureAwait(false);
        await ReseedOrderListsAsync().ConfigureAwait(false);
    }

    // Respawn empties ExpenseCategories, but the ten migration-seeded rows belong to every database (D-09), and an expense
    // needs its category foreign key (research Pitfall 1). Put back any that are missing, from the same seed the migration uses.
    private async Task ReseedExpenseCategoriesAsync()
    {
        var context = CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var present = await context.ExpenseCategories.AsNoTracking().Select(category => category.Id).ToListAsync().ConfigureAwait(false);
            var missing = ExpenseCategorySeed.Rows.Where(row => !present.Contains(row.Id)).ToList();
            if (missing.Count == 0)
            {
                return;
            }

            context.ExpenseCategories.AddRange(missing.Select(ExpenseCategory.FromSeed));
            await context.SaveChangesAsync().ConfigureAwait(false);
        }
    }

    // Respawn also empties the order list tables, but their migration-seeded rows belong to every database (D-16, D-17, D-18).
    // Put back any that are missing, from the same seed the migration uses.
    private async Task ReseedOrderListsAsync()
    {
        var context = CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var productTypes = await context.ProductTypes.AsNoTracking().Select(entry => entry.Id).ToListAsync().ConfigureAwait(false);
            context.ProductTypes.AddRange(OrderListSeed.ProductTypes.Where(row => !productTypes.Contains(row.Id)).Select(ProductType.FromSeed));

            var paymentMethods = await context.PaymentMethods.AsNoTracking().Select(entry => entry.Id).ToListAsync().ConfigureAwait(false);
            context.PaymentMethods.AddRange(OrderListSeed.PaymentMethods.Where(row => !paymentMethods.Contains(row.Id)).Select(PaymentMethod.FromSeed));

            var categories = await context.OrderExpenseCategories.AsNoTracking().Select(entry => entry.Id).ToListAsync().ConfigureAwait(false);
            context.OrderExpenseCategories.AddRange(OrderListSeed.OrderExpenseCategories.Where(row => !categories.Contains(row.Id)).Select(OrderExpenseCategory.FromSeed));

            await context.SaveChangesAsync().ConfigureAwait(false);
        }
    }

    // True when at least one user table is not on the ignore list (names compared like Respawn: any schema).
    private static async Task<bool> HasResettableTableAsync(SqlConnection connection)
    {
        var command = connection.CreateCommand();
        await using (command.ConfigureAwait(false))
        {
            var parameters = new List<string>();
            for (var index = 0; index < IgnoredTables.Length; index++)
            {
                var parameter = "@ignored" + index.ToString(System.Globalization.CultureInfo.InvariantCulture);
                parameters.Add(parameter);
                command.Parameters.AddWithValue(parameter, IgnoredTables[index]);
            }

            command.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE is_ms_shipped = 0 AND name NOT IN ("
                + string.Join(", ", parameters) + ");";
            var count = await command.ExecuteScalarAsync().ConfigureAwait(false);
            return Convert.ToInt32(count, System.Globalization.CultureInfo.InvariantCulture) > 0;
        }
    }

    /// <summary>Creates a new context on this database. The caller disposes it.</summary>
    /// <returns>A context built through <see cref="CspsDbContextOptions.Configure"/>.</returns>
    public CspsDbContext CreateContext() => CreateContext([]);

    /// <summary>Creates a new context on this database with extra interceptors, such as a <see cref="CommandCounter"/>. The caller disposes it.</summary>
    /// <param name="extra">Interceptors added after the ones <see cref="CspsDbContextOptions.Configure"/> adds.</param>
    /// <returns>A context built through <see cref="CspsDbContextOptions.Configure"/>.</returns>
    public CspsDbContext CreateContext(params IInterceptor[] extra)
    {
        ArgumentNullException.ThrowIfNull(extra);
        if (string.IsNullOrEmpty(ConnectionString))
        {
            throw new InvalidOperationException("The test database is not initialized yet.");
        }

        var builder = new DbContextOptionsBuilder<CspsDbContext>();
        CspsDbContextOptions.Configure(builder, ConnectionString);
        if (extra.Length > 0)
        {
            builder.AddInterceptors(extra);
        }

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

    private async Task CreateDatabaseAsync(int compatibilityLevel)
    {
        _server = await SqlServerInstance.GetSharedAsync().ConfigureAwait(false);
        var quoted = QuotedName();

        await ExecuteOnMasterAsync($"CREATE DATABASE {quoted};").ConfigureAwait(false);
        await ExecuteOnMasterAsync($"ALTER DATABASE {quoted} SET COMPATIBILITY_LEVEL = {compatibilityLevel};").ConfigureAwait(false);

        ConnectionString = _server.ConnectionStringFor(DatabaseName);
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
