using System.Globalization;
using System.Text.RegularExpressions;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// CONT-02, D-01, D-02, D-06, D-09, OR-7: the AddProductLines migration creates the two tables with CHECK constraints instead of triggers,
/// inserts the six lines once, adds the nullable ProductTypes link with a Restrict key, changes no existing row and refuses to be undone.
/// Tests that add rows use their own keys and take them out again, because the six seeded rows stay in this database.
/// </summary>
public sealed class ProductLinesMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task SeedMatchesTheSeedListFieldByField()
    {
        await using var context = database.CreateContext();

        var rows = await context.ProductLines.AsNoTracking().OrderBy(line => line.Position).ToListAsync(TestContext.Current.CancellationToken);

        rows.Count.ShouldBe(ProductLineSeed.All.Count);
        for (var index = 0; index < rows.Count; index++)
        {
            var row = rows[index];
            var entry = ProductLineSeed.All[index];
            row.Id.ShouldBe(entry.Id);
            row.Key.ShouldBe(entry.Key);
            row.Title.ShouldBe(entry.Title);
            row.ShortName.ShouldBe(entry.ShortName);
            row.Number.ShouldBe(entry.Number);
            row.CardText.ShouldBe(entry.CardText);
            row.Description.ShouldBe(entry.Description);
            row.FabricText.ShouldBe(entry.FabricText);
            row.CollarText.ShouldBe(entry.CollarText);
            row.CutText.ShouldBe(entry.CutText);
            row.NamesText.ShouldBe(entry.NamesText);
            row.LogosText.ShouldBe(entry.LogosText);
            row.Position.ShouldBe(entry.Position);
            row.PlaceholderArt.ShouldBe(entry.PlaceholderArt);
            row.IsActive.ShouldBeTrue();
            row.StartsAtPrice.ShouldBeNull();
            row.MinimumQuantity.ShouldBeNull();
            row.CreatedAtUtc.ShouldBe(ProductLineSeed.SeededAtUtc);
            row.CreatedById.ShouldBeNull();
            row.UpdatedAtUtc.ShouldBeNull();
        }
    }

    [Fact]
    public async Task PriceCheckRejectsZeroAndMoreThanTheCapAndAcceptsTheLimits()
    {
        var zero = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), price: "0")));
        var tooHigh = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), price: "1000000.00")));
        var negative = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), price: "-1")));

        zero.Message.ShouldContain("CK_ProductLines_Price");
        tooHigh.Message.ShouldContain("CK_ProductLines_Price");
        negative.Message.ShouldContain("CK_ProductLines_Price");
        var lowest = NewKey();
        var highest = NewKey();
        try
        {
            await ExecuteAsync(InsertLine(lowest, price: "0.01"));
            await ExecuteAsync(InsertLine(highest, price: "999999.99"));
        }
        finally
        {
            await DeleteLinesAsync(lowest, highest);
        }
    }

    [Fact]
    public async Task MinimumCheckRejectsZeroAndTenThousandAndAcceptsOneAndNineThousandNineHundredNinetyNine()
    {
        var zero = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), minimum: "0")));
        var tooMany = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), minimum: "10000")));

        zero.Message.ShouldContain("CK_ProductLines_Minimum");
        tooMany.Message.ShouldContain("CK_ProductLines_Minimum");
        var lowest = NewKey();
        var highest = NewKey();
        try
        {
            await ExecuteAsync(InsertLine(lowest, minimum: "1"));
            await ExecuteAsync(InsertLine(highest, minimum: "9999"));
        }
        finally
        {
            await DeleteLinesAsync(lowest, highest);
        }
    }

    [Fact]
    public async Task ShortNameUniqueIgnoresCaseAndKeyIsUniqueToo()
    {
        var sameShortName = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine(NewKey(), shortName: "basketball")));
        var sameKey = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertLine("basketball", shortName: NewKey())));

        sameShortName.Message.ShouldContain("UX_ProductLines_ShortName");
        sameKey.Message.ShouldContain("UX_ProductLines_Key");
    }

    [Fact]
    public async Task APhotoSlotIsUniquePerLineAndLimitedToThreeSlots()
    {
        var key = NewKey();
        await ExecuteAsync(InsertLine(key));
        try
        {
            await ExecuteAsync(InsertPhoto(key, 0));
            await ExecuteAsync(InsertPhoto(key, 1));
            await ExecuteAsync(InsertPhoto(key, 2));

            var duplicate = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertPhoto(key, 1)));
            var outOfRange = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertPhoto(key, 3)));

            duplicate.Message.ShouldContain("UX_ProductLinePhotos_LineSlot");
            outOfRange.Message.ShouldContain("CK_ProductLinePhotos_Slot");
        }
        finally
        {
            await ExecuteAsync($"DELETE FROM dbo.ProductLinePhotos WHERE LineId IN (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}')");
            await DeleteLinesAsync(key);
        }
    }

    [Fact]
    public async Task RestrictDeleteStopsRemovingALineThatHasAPhotoOrALinkedProductType()
    {
        var key = NewKey();
        await ExecuteAsync(InsertLine(key));
        try
        {
            await ExecuteAsync(InsertPhoto(key, 0));
            var withPhoto = await Should.ThrowAsync<SqlException>(() => DeleteLinesAsync(key));
            withPhoto.Message.ShouldContain("FK_ProductLinePhotos_ProductLines_LineId");
            await ExecuteAsync($"DELETE FROM dbo.ProductLinePhotos WHERE LineId IN (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}')");

            await ExecuteAsync($"UPDATE TOP (1) dbo.ProductTypes SET ProductLineId = (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}')");
            var withType = await Should.ThrowAsync<SqlException>(() => DeleteLinesAsync(key));
            withType.Message.ShouldContain("FK_ProductTypes_ProductLines_ProductLineId");
        }
        finally
        {
            await ExecuteAsync($"UPDATE dbo.ProductTypes SET ProductLineId = NULL WHERE ProductLineId IN (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}')");
            await ExecuteAsync($"DELETE FROM dbo.ProductLinePhotos WHERE LineId IN (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}')");
            await DeleteLinesAsync(key);
        }
    }

    [Fact]
    public async Task ExistingProductTypesStayUnlinkedAndTheLinkColumnIsNullableAndIndexed()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.ProductTypes")).ShouldBeGreaterThan(0);
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.ProductTypes WHERE ProductLineId IS NOT NULL")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.ProductTypes') AND name = N'ProductLineId' AND is_nullable = 1")).ShouldBe(1);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.ProductTypes') AND name = N'IX_ProductTypes_ProductLineId'")).ShouldBe(1);
    }

    [Fact]
    public async Task TheNewTablesHaveNoTrigger()
    {
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id IN (OBJECT_ID(N'dbo.ProductLines'), OBJECT_ID(N'dbo.ProductLinePhotos'))")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.tables WHERE name IN (N'ProductLines', N'ProductLinePhotos')")).ShouldBe(2);
    }

    [Fact]
    public async Task TheIdempotentScriptInsertsTheSixLinesOnceGuardedByTheMigrationId()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_AddProductLines", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                var before = all[index - 1];
                await migrator.MigrateAsync(before, TestContext.Current.CancellationToken);
                var script = migrator.GenerateScript(fromMigration: before, options: MigrationsSqlGenerationOptions.Idempotent);

                script.ShouldContain(all[index]);
                script.ShouldContain("INSERT INTO [ProductLines]");
                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
                script.ShouldNotContain("DROP TABLE", Case.Insensitive);
                script.ShouldNotContain("UPDATE [ProductTypes]", Case.Insensitive);
                await ApplyAsync(empty.ConnectionString, script);
                await ApplyAsync(empty.ConnectionString, script);
            }

            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.ProductLines")).ShouldBe(6);
            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.ProductLines WHERE StartsAtPrice IS NULL AND MinimumQuantity IS NULL AND IsActive = 1")).ShouldBe(6);
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheLines()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                await migrator.MigrateAsync(cancellationToken: TestContext.Current.CancellationToken);
                var all = context.Database.GetMigrations().ToList();
                var before = all[all.FindIndex(id => id.EndsWith("_AddProductLines", StringComparison.Ordinal)) - 1];

                await Should.ThrowAsync<NotSupportedException>(() => migrator.MigrateAsync(before, TestContext.Current.CancellationToken));
            }
        }
    }

    private static string NewKey() => "t" + Guid.NewGuid().ToString("N")[..12];

    private static string InsertLine(string key, string shortName = "", string price = "NULL", string minimum = "NULL")
    {
        var name = shortName.Length == 0 ? key : shortName;
        return string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.ProductLines (Id, [Key], Title, ShortName, Number, CardText, Description, FabricText, CollarText, CutText, NamesText, LogosText, StartsAtPrice, MinimumQuantity, Position, IsActive, PlaceholderArt, CreatedAtUtc) VALUES (NEWID(), N'{key}', N'Test line', N'{name}', N'99', N'Card', N'Description', N'Fabric', N'Collar', N'Cut', N'Names', N'Logos', {price}, {minimum}, 99, 1, 'Custom', SYSDATETIMEOFFSET())");
    }

    private static string InsertPhoto(string key, int slot) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.ProductLinePhotos (Id, LineId, Slot, PublicId, Width, Height, Bytes, Format, CreatedAtUtc) VALUES (NEWID(), (SELECT Id FROM dbo.ProductLines WHERE [Key] = N'{key}'), {slot}, N'test/{Guid.NewGuid():N}', 100, 100, 1000, 'jpg', SYSDATETIMEOFFSET())");

    private Task DeleteLinesAsync(params string[] keys) =>
        ExecuteAsync($"DELETE FROM dbo.ProductLines WHERE [Key] IN ({string.Join(", ", keys.Select(key => $"N'{key}'"))})");

    private Task<int> ScalarAsync(string sql) => ScalarAsync(database.ConnectionString, sql);

    private static async Task<int> ScalarAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                return Convert.ToInt32(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken), CultureInfo.InvariantCulture);
            }
        }
    }

    private Task ExecuteAsync(string sql) => ApplyAsync(database.ConnectionString, sql);

    private static async Task ApplyAsync(string connectionString, string sql)
    {
        var connection = new SqlConnection(connectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            foreach (var batch in Regex.Split(sql, @"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.CultureInvariant))
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
    }
}
