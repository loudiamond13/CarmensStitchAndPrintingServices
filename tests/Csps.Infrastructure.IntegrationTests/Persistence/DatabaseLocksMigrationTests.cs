using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-50: the DatabaseLocks table, its 66 standing rows, its primary key and its survival through the test reset.</summary>
public sealed class DatabaseLocksMigrationTests
{
    [Fact]
    public async Task AFreshlyMigratedDatabaseHasTheSixtySixStandingLockRows()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var context = database.CreateContext();
            await using (context)
            {
                var rows = await context.Set<DatabaseLock>().AsNoTracking().OrderBy(row => row.Name).ToListAsync(TestContext.Current.CancellationToken);

                rows.Count.ShouldBe(66);
                rows.Select(row => row.Name).ShouldBe(DatabaseLocks.StandingNames.Order(StringComparer.Ordinal));
                rows.Select(row => row.Name).ShouldContain("active-managers");
                rows.Select(row => row.Name).ShouldContain("order-numbers");
                rows.Select(row => row.Name).ShouldContain("account-token:00");
                rows.Select(row => row.Name).ShouldContain("account-token:63");
                rows.ShouldAllBe(row => row.TakenAtUtc == null && row.ExpiresAtUtc == null && row.HolderId == null);
            }
        }
    }

    [Fact]
    public async Task ASecondRowWithAnExistingNameIsRefusedByThePrimaryKey()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var connection = new SqlConnection(database.ConnectionString);
            await using (connection)
            {
                await connection.OpenAsync(TestContext.Current.CancellationToken);
                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = "INSERT INTO DatabaseLocks (Name) VALUES (N'active-managers');";

                    var error = await Should.ThrowAsync<SqlException>(() => command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken));

                    error.Number.ShouldBe(2627);
                }
            }
        }
    }

    [Fact]
    public async Task TheTestResetKeepsTheStandingRows()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            await database.ResetAsync();

            var context = database.CreateContext();
            await using (context)
            {
                (await context.Set<DatabaseLock>().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(66);
            }
        }
    }
}
