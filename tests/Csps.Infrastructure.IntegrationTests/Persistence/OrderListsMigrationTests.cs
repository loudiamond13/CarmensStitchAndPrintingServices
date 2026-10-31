using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>D-16, D-17, D-18, D-19: the three order list tables, their seventeen seed rows, unique names, tone checks and row versions.</summary>
public sealed class OrderListsMigrationTests
{
    private static readonly (string Table, int Seeded)[] Lists =
    [
        ("ProductTypes", 6),
        ("PaymentMethods", 5),
        ("OrderExpenseCategories", 6),
    ];

    public static TheoryData<string, int> Tables => new()
    {
        { "ProductTypes", 6 },
        { "PaymentMethods", 5 },
        { "OrderExpenseCategories", 6 },
    };

    [Theory]
    [MemberData(nameof(Tables))]
    public async Task AFreshlyMigratedDatabaseHasTheTableWithItsSeedRows(string table, int seeded)
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            (await ScalarAsync(database, $"SELECT COUNT(*) FROM [{table}] WHERE RetiredAtUtc IS NULL AND CreatedById IS NULL")).ShouldBe(seeded);
        }
    }

    [Theory]
    [MemberData(nameof(Tables))]
    public async Task TheNormalizedNameIsUniqueAndTheToneAndRowVersionAreEnforced(string table, int seeded)
    {
        _ = seeded;
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            (await ScalarAsync(database, $"SELECT COUNT(*) FROM sys.indexes WHERE name = 'IX_{table}_NormalizedName' AND is_unique = 1")).ShouldBe(1);
            (await ScalarAsync(database, $"SELECT COUNT(*) FROM sys.check_constraints WHERE name = 'CK_{table}_Tone'")).ShouldBe(1);
            (await ScalarAsync(database, $"SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID('{table}') AND c.name = 'RowVersion' AND t.name = 'timestamp'")).ShouldBe(1);

            var existing = await NormalizedNameOfFirstAsync(database, table);
            var duplicate = await Should.ThrowAsync<SqlException>(() => InsertAsync(database, table, "Another", existing, "neutral"));
            duplicate.Message.ShouldContain($"IX_{table}_NormalizedName");

            var tone = await Should.ThrowAsync<SqlException>(() => InsertAsync(database, table, "Fresh", "FRESH", "purple"));
            tone.Message.ShouldContain($"CK_{table}_Tone");
        }
    }

    [Fact]
    public async Task NoListTableHasADiscriminatorColumn()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            foreach (var (table, _) in Lists)
            {
                (await ScalarAsync(database, $"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID('{table}') AND name = 'Discriminator'")).ShouldBe(0);
            }
        }
    }

    [Fact]
    public async Task TheTestResetBringsTheSeventeenRowsBack()
    {
        var database = await CspsDatabase.CreateAsync();
        await using (database)
        {
            await database.ResetAsync();

            var total = 0;
            foreach (var (table, _) in Lists)
            {
                total += await ScalarAsync(database, $"SELECT COUNT(*) FROM [{table}]");
            }

            total.ShouldBe(17);
        }
    }

    // Raw SQL so the tests reach the database constraints, not the domain rules.
    private static async Task<int> ScalarAsync(CspsDatabase database, string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), System.Globalization.CultureInfo.InvariantCulture);
            }
        }
    }

    private static async Task<string> NormalizedNameOfFirstAsync(CspsDatabase database, string table)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = $"SELECT TOP 1 NormalizedName FROM [{table}] ORDER BY NormalizedName";
                return (string)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

    private static async Task InsertAsync(CspsDatabase database, string table, string name, string normalizedName, string tone)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = $"INSERT INTO [{table}] (Id, Name, NormalizedName, Tone, CreatedAtUtc) VALUES (@id, @name, @normalized, @tone, SYSUTCDATETIME());";
                command.Parameters.AddWithValue("@id", Guid.NewGuid());
                command.Parameters.AddWithValue("@name", name);
                command.Parameters.AddWithValue("@normalized", normalizedName);
                command.Parameters.AddWithValue("@tone", tone);
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }
}
