using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// CONT-01, D-23, D-39, OR-7: the AddSiteContactDetails migration widens SiteSettings, adds the phone table with its indexes, drops
/// nothing, and blanks the contact email and Facebook link only where they still hold their bracket placeholders.
/// </summary>
public sealed partial class SiteContactDetailsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Before = "20261107110304_AddMoneyTransfers";
    private const string EmailPlaceholder = "[hello@yourdomain.ph]";
    private const string FacebookPlaceholder = "[Facebook page URL]";

    [Fact]
    public async Task TheNewSettingsColumnsExistWithTheirLengthsAndNothingOldIsGone()
    {
        var columns = await ReadColumnsAsync("SiteSettings");

        columns["Tagline"].ShouldBe(new Column("nvarchar", 160, false));
        columns["AboutText"].ShouldBe(new Column("nvarchar", 600, true));
        columns["TurnaroundLine"].ShouldBe(new Column("nvarchar", 120, true));
        columns["Street"].ShouldBe(new Column("nvarchar", 120, true));
        columns["TownOrCity"].ShouldBe(new Column("nvarchar", 60, true));
        columns["Province"].ShouldBe(new Column("nvarchar", 60, true));
        columns["PostalCode"].ShouldBe(new Column("nvarchar", 4, true));
        columns["DirectionsUrl"].ShouldBe(new Column("nvarchar", 300, true));
        columns["MapEmbedUrl"].ShouldBe(new Column("nvarchar", 1000, true));
        columns["MessengerUrl"].ShouldBe(new Column("nvarchar", 120, true));
        columns["InstagramUrl"].ShouldBe(new Column("nvarchar", 300, true));
        columns["TikTokUrl"].ShouldBe(new Column("nvarchar", 300, true));

        // D-39: the old columns stay, unused, with their old names and types.
        columns["ContactPhone"].ShouldBe(new Column("nvarchar", 32, false));
        columns["AddressLine"].ShouldBe(new Column("nvarchar", 200, false));
        columns["ContactEmail"].ShouldBe(new Column("nvarchar", 254, false));
        columns["FacebookUrl"].ShouldBe(new Column("nvarchar", 300, false));
        columns["CreatedByUserId"].ShouldBe(new Column("uniqueidentifier", null, true));
        columns["UpdatedByUserId"].ShouldBe(new Column("uniqueidentifier", null, true));
        columns.ContainsKey("CreatedById").ShouldBeFalse("the stamp properties map onto the old column names");
        columns.ContainsKey("UpdatedById").ShouldBeFalse("the stamp properties map onto the old column names");
    }

    [Fact]
    public async Task ThePhoneTableHasTheColumnsOfTheDesign()
    {
        var columns = await ReadColumnsAsync("SitePhoneNumbers");

        columns["Id"].ShouldBe(new Column("uniqueidentifier", null, false));
        columns["Number"].ShouldBe(new Column("nvarchar", 16, false));
        columns["Label"].ShouldBe(new Column("nvarchar", 20, true));
        columns["IsMain"].ShouldBe(new Column("bit", null, false));
        columns["Position"].ShouldBe(new Column("int", null, false));
        columns["CreatedById"].ShouldBe(new Column("uniqueidentifier", null, true));
        columns["CreatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, false));
        columns["UpdatedById"].ShouldBe(new Column("uniqueidentifier", null, true));
        columns["UpdatedAtUtc"].ShouldBe(new Column("datetimeoffset", null, true));
        columns.Count.ShouldBe(9);
    }

    [Fact]
    public async Task ANumberCannotBeListedTwiceAndOnlyOneRowCanBeMain()
    {
        await ClearPhonesAsync();
        await InsertPhoneAsync("+639171234567", isMain: true, position: 0);
        await InsertPhoneAsync("+63281234567", isMain: false, position: 1);
        await InsertPhoneAsync("+639181234567", isMain: false, position: 2);

        var duplicate = await Should.ThrowAsync<SqlException>(() => InsertPhoneAsync("+63281234567", isMain: false, position: 3));
        var secondMain = await Should.ThrowAsync<SqlException>(() => InsertPhoneAsync("+639191234567", isMain: true, position: 3));

        duplicate.Message.ShouldContain("UX_SitePhoneNumbers_Number");
        secondMain.Message.ShouldContain("UX_SitePhoneNumbers_Main");
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.SitePhoneNumbers")).ShouldBe(3);
    }

    [Fact]
    public async Task TheMigrationAddsNoTriggerAndTheTableHasNoForeignKey()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id IN (OBJECT_ID(N'dbo.SiteSettings'), OBJECT_ID(N'dbo.SitePhoneNumbers'))")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID(N'dbo.SitePhoneNumbers')")).ShouldBe(0);
    }

    [Fact]
    public async Task AFreshDatabaseStartsWithTheApprovedTaglineAndNoPublicContactValues()
    {
        await using var context = database.CreateContext();

        var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);

        row.Tagline.ShouldBe("Custom tailoring and full-sublimation printing for teams, leagues and riding groups.");
        row.ContactEmail.ShouldBeEmpty();
        row.FacebookUrl.ShouldBeEmpty();
        new[]
        {
            row.AboutText, row.TurnaroundLine, row.Street, row.TownOrCity, row.Province, row.PostalCode, row.DirectionsUrl, row.MapEmbedUrl,
            row.MessengerUrl, row.InstagramUrl, row.TikTokUrl,
        }.ShouldAllBe(value => value == null);
    }

    [Theory]
    [InlineData(false, EmailPlaceholder, FacebookPlaceholder, "", "")]
    [InlineData(true, EmailPlaceholder, FacebookPlaceholder, "", "")]
    [InlineData(false, "owner@example.test", "https://facebook.example.test/real", "owner@example.test", "https://facebook.example.test/real")]
    [InlineData(true, "owner@example.test", EmailPlaceholder, "owner@example.test", "")]
    [InlineData(false, EmailPlaceholder, "https://facebook.example.test/real", "", "https://facebook.example.test/real")]
    public async Task OnlyTheValuesThatStillHoldTheBracketPlaceholdersAreBlanked(
        bool throughTheReviewedScript, string email, string facebook, string expectedEmail, string expectedFacebook)
    {
        var old = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (old)
        {
            var context = old.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(Before, TestContext.Current.CancellationToken);
                await ExecuteAsync(
                    old.ConnectionString,
                    "UPDATE dbo.SiteSettings SET ContactEmail = @email, FacebookUrl = @facebook WHERE Id = 1;",
                    ("@email", email),
                    ("@facebook", facebook));

                if (throughTheReviewedScript)
                {
                    await ApplyScriptAsync(
                        old.ConnectionString,
                        migrator.GenerateScript(fromMigration: Before, options: MigrationsSqlGenerationOptions.Idempotent));
                }
                else
                {
                    await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);
                }
            }

            await using var reading = old.CreateContext();
            var after = await reading.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
            after.ContactEmail.ShouldBe(expectedEmail);
            after.FacebookUrl.ShouldBe(expectedFacebook);
            after.ContactPhone.ShouldBe("[0917 000 0000]", "the old phone column is untouched");
            after.AddressLine.ShouldBe("[Shop address], [City], Philippines", "the old address column is untouched");
            after.Tagline.ShouldBe("Custom tailoring and full-sublimation printing for teams, leagues and riding groups.");
            after.Street.ShouldBeNull("a placeholder is never copied into a new field");
            after.TownOrCity.ShouldBeNull();
            after.Province.ShouldBeNull();
            after.MessengerUrl.ShouldBeNull();
        }
    }

    [Fact]
    public async Task TheMigrationScriptHoldsNoDropRenameOrTriggerStatement()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var script = context.GetService<IMigrator>().GenerateScript(fromMigration: Before, options: MigrationsSqlGenerationOptions.Idempotent);

                DropOrRename().IsMatch(script).ShouldBeFalse("D-39: no column is dropped or renamed");
                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
            }
        }
    }

    private async Task<Dictionary<string, Column>> ReadColumnsAsync(string table)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = N'dbo' AND TABLE_NAME = @table;";
                command.Parameters.AddWithValue("@table", table);
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    var columns = new Dictionary<string, Column>(StringComparer.Ordinal);
                    while (await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        columns[reader.GetString(0)] = new Column(
                            reader.GetString(1),
                            reader.IsDBNull(2) ? null : reader.GetInt32(2),
                            string.Equals(reader.GetString(3), "YES", StringComparison.Ordinal));
                    }

                    return columns;
                }
            }
        }
    }

    private async Task ClearPhonesAsync() => await ExecuteAsync(database.ConnectionString, "DELETE FROM dbo.SitePhoneNumbers;");

    private async Task InsertPhoneAsync(string number, bool isMain, int position) =>
        await ExecuteAsync(
            database.ConnectionString,
            "INSERT INTO dbo.SitePhoneNumbers (Id, Number, IsMain, Position, CreatedAtUtc) VALUES (NEWID(), @number, @isMain, @position, SYSUTCDATETIME());",
            ("@number", number),
            ("@isMain", isMain),
            ("@position", position));

    private async Task<int> ScalarAsync(string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
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

    private static async Task ExecuteAsync(string connectionString, string sql, params (string Name, object Value)[] parameters)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                foreach (var (name, value) in parameters)
                {
                    command.Parameters.AddWithValue(name, value);
                }

                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private static async Task ApplyScriptAsync(string connectionString, string script)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            foreach (var batch in GoSeparator().Split(script).Where(static batch => !string.IsNullOrWhiteSpace(batch)))
            {
                var command = connection.CreateCommand();
                await using (command)
                {
                    command.CommandText = batch;
                    await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
                }
            }
        }
    }

    [GeneratedRegex(@"DROP\s+COLUMN|DROP\s+TABLE|sp_rename", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex DropOrRename();

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex GoSeparator();

    private sealed record Column(string Type, int? Length, bool Nullable);
}
