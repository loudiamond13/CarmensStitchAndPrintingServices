using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// FND-01: an empty CSPS_Test database gets the full schema, including the SiteSettings singleton, from the
/// migrations alone. Assertions read the database with plain SQL, independent of the EF model.
/// </summary>
public sealed class MigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task FreshDatabaseHasSiteSettingsSingleton()
    {
        var connection = await OpenAsync();
        await using (connection)
        {
            (await TableExistsAsync(connection, "SiteSettings")).ShouldBeTrue("The migrations must create the SiteSettings table.");

            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT Id, BusinessName, TimeZoneId, CurrencyCode, Locale, ContactEmail, ContactPhone, AddressLine, FacebookUrl FROM dbo.SiteSettings;";
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue("SiteSettings must hold the seeded row.");

                    reader.GetInt32(0).ShouldBe(1);
                    reader.GetString(1).ShouldBe("Carmen's Stitch & Printing Services");
                    reader.GetString(2).ShouldBe("Asia/Manila");
                    reader.GetString(3).ShouldBe("PHP");
                    reader.GetString(4).ShouldBe("en-PH");
                    reader.GetString(5).ShouldBe("[hello@yourdomain.ph]");
                    reader.GetString(6).ShouldBe("[0917 000 0000]");
                    reader.GetString(7).ShouldBe("[Shop address], [City], Philippines");
                    reader.GetString(8).ShouldBe("[Facebook page URL]");

                    (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeFalse("SiteSettings must hold exactly one row.");
                }
            }
        }
    }

    [Fact]
    public async Task MigratingTwiceIsANoOp()
    {
        var context = database.CreateContext();
        await using (context)
        {
            await context.Database.MigrateAsync(TestContext.Current.CancellationToken);

            (await context.Database.GetPendingMigrationsAsync(TestContext.Current.CancellationToken)).ShouldBeEmpty();
        }

        var connection = await OpenAsync();
        await using (connection)
        {
            (await CountSiteSettingsRowsAsync(connection)).ShouldBe(1);
        }
    }

    [Fact]
    public async Task SecondSingletonRowIsRejected()
    {
        var connection = await OpenAsync();
        await using (connection)
        {
            (await TableExistsAsync(connection, "SiteSettings")).ShouldBeTrue("The migrations must create the SiteSettings table.");

            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "INSERT INTO dbo.SiteSettings (Id, BusinessName, TimeZoneId, CurrencyCode, Locale, ContactEmail, ContactPhone, AddressLine, FacebookUrl, CreatedAtUtc) "
                    + "VALUES (2, N'Second', N'Asia/Manila', N'PHP', N'en-PH', N'a', N'b', N'c', N'd', SYSUTCDATETIME());";

                var error = await Should.ThrowAsync<SqlException>(() => command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken));

                error.Message.ShouldContain("CK_SiteSettings_Singleton");
            }

            (await CountSiteSettingsRowsAsync(connection)).ShouldBe(1);
        }
    }

    private async Task<SqlConnection> OpenAsync()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        return connection;
    }

    private static async Task<bool> TableExistsAsync(SqlConnection connection, string table)
    {
        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = "SELECT COUNT(*) FROM sys.tables WHERE name = @name AND schema_id = SCHEMA_ID(N'dbo');";
            command.Parameters.AddWithValue("@name", table);
            return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))! == 1;
        }
    }

    private static async Task<int> CountSiteSettingsRowsAsync(SqlConnection connection)
    {
        if (!await TableExistsAsync(connection, "SiteSettings"))
        {
            return 0;
        }

        var command = connection.CreateCommand();
        await using (command)
        {
            command.CommandText = "SELECT COUNT(*) FROM dbo.SiteSettings;";
            return (int)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
        }
    }
}
