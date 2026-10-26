using Csps.Domain.Expenses;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-08, D-09, D-13: the ExpenseCategories table, its ten seeded rows, its unique name and its tone check.</summary>
public sealed class ExpenseCategoriesMigrationTests
{
    [Fact]
    public async Task AFreshlyMigratedDatabaseHasTheTenCategories()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var context = database.CreateContext();
            await using (context)
            {
                var rows = await context.ExpenseCategories.AsNoTracking().OrderBy(row => row.Name).ToListAsync(TestContext.Current.CancellationToken);

                rows.Select(row => row.Name).ShouldBe(ExpenseCategorySeed.Rows.Select(row => row.Name).Order(StringComparer.Ordinal));
                rows.Single(row => row.Name == "Others").Id.ShouldBe(ExpenseCategorySeed.OthersId);
                rows.ShouldAllBe(row => row.RetiredAtUtc == null && row.CreatedById == null);
            }
        }
    }

    [Fact]
    public async Task ASecondRowWithTheSameNormalizedNameIsRefused()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var error = await Should.ThrowAsync<SqlException>(() => InsertAsync(database, "Rent again", "RENT", "neutral"));

            error.Message.ShouldContain("IX_ExpenseCategories_NormalizedName");
        }
    }

    [Fact]
    public async Task AToneOutsideTheSixIsRefused()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            var error = await Should.ThrowAsync<SqlException>(() => InsertAsync(database, "Fresh", "FRESH", "danger"));

            error.Message.ShouldContain("CK_ExpenseCategories_Tone");
        }
    }

    [Fact]
    public async Task TheTestResetBringsTheTenCategoriesBack()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            await database.ResetAsync();

            var context = database.CreateContext();
            await using (context)
            {
                (await context.ExpenseCategories.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(10);
            }
        }
    }

    // Raw insert so the tests reach the database constraints, not the domain rules.
    private static async Task InsertAsync(CspsDatabase database, string name, string normalizedName, string tone)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "INSERT INTO ExpenseCategories (Id, Name, NormalizedName, Tone, CreatedAtUtc) VALUES (@id, @name, @normalized, @tone, SYSUTCDATETIME());";
                command.Parameters.AddWithValue("@id", Guid.NewGuid());
                command.Parameters.AddWithValue("@name", name);
                command.Parameters.AddWithValue("@normalized", normalizedName);
                command.Parameters.AddWithValue("@tone", tone);
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }
}
