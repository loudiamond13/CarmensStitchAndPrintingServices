using System.Globalization;
using System.Text.RegularExpressions;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Csps.Infrastructure.IntegrationTests.Persistence;

/// <summary>
/// D-09 to D-11, GAL-03, OR-7: the AddOrderPublicSettings migration adds five nullable columns to Orders and creates the gallery table with
/// CHECK constraints instead of triggers. It changes no existing value, inserts no row and refuses to be undone. Tests that add rows take
/// them out again.
/// </summary>
public sealed class OrderPublicSettingsMigrationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly string[] NewColumns = ["PublicConsentAtUtc", "PublicConsentById", "ShownOnWebsiteSinceUtc", "PublicProductLineId", "PublicName"];

    [Fact]
    public async Task TheFiveOrderColumnsAreNullableAndNullOnAnOrderThatExistedBeforeTheMigration()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_AddOrderPublicSettings", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                await migrator.MigrateAsync(all[index - 1], TestContext.Current.CancellationToken);
                await ApplyAsync(empty.ConnectionString, InsertOrderSql(Guid.NewGuid(), "T-OLD-0001"));

                await migrator.MigrateAsync(all[index], TestContext.Current.CancellationToken);
            }

            foreach (var column in NewColumns)
            {
                (await ScalarAsync(empty.ConnectionString, $"SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Orders') AND name = N'{column}' AND is_nullable = 1")).ShouldBe(1, column);
            }

            (await ScalarAsync(
                empty.ConnectionString,
                "SELECT COUNT(*) FROM dbo.Orders WHERE PublicConsentAtUtc IS NULL AND PublicConsentById IS NULL AND ShownOnWebsiteSinceUtc IS NULL AND PublicProductLineId IS NULL AND PublicName IS NULL")).ShouldBe(1);
            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(0);
        }
    }

    [Fact]
    public async Task AnOrderEntryNeedsAnOrderAndAnUploadNeedsItsPhotoTeamAndLineAndNoOrder()
    {
        await database.ResetAsync();
        var orderId = Guid.NewGuid();
        await ExecuteAsync(InsertOrderSql(orderId, "T-GAL-0001"));
        var lineId = await FirstLineAsync();

        var orderWithoutOrder = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Order", null, null, null, null, null)));
        var noPhoto = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", null, null, "Sample Team", lineId, null)));
        var noTeam = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", null, lineId, null)));
        var noLine = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", null, null)));
        var uploadWithOrder = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", orderId, "sample-photo-id", "Sample Team", lineId, null)));
        var unknownKind = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Other", orderId, null, null, null, null)));

        foreach (var error in new[] { orderWithoutOrder, noPhoto, noTeam, noLine, uploadWithOrder, unknownKind })
        {
            error.Message.ShouldContain("CK_GalleryEntries_Kind");
        }

        try
        {
            await ExecuteAsync(InsertEntry("Order", orderId, null, null, null, null));
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, 12));
            (await ScalarAsync("SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(2);
        }
        finally
        {
            await ExecuteAsync("DELETE FROM dbo.GalleryEntries");
        }
    }

    [Fact]
    public async Task PiecesOfZeroAndOfTenThousandAreRejectedAndOneAndNinetyNineNinetyNineAreKept()
    {
        await database.ResetAsync();
        var lineId = await FirstLineAsync();

        var zero = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, 0)));
        var tooMany = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, 10000)));

        zero.Message.ShouldContain("CK_GalleryEntries_Pieces");
        tooMany.Message.ShouldContain("CK_GalleryEntries_Pieces");
        try
        {
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, 1));
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, 9999));
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, null));
            (await ScalarAsync("SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(3);
        }
        finally
        {
            await ExecuteAsync("DELETE FROM dbo.GalleryEntries");
        }
    }

    [Fact]
    public async Task ASecondEntryForTheSameOrderIsRefusedByTheFilteredUniqueIndexButUploadsMayRepeat()
    {
        await database.ResetAsync();
        var orderId = Guid.NewGuid();
        await ExecuteAsync(InsertOrderSql(orderId, "T-GAL-0002"));
        try
        {
            await ExecuteAsync(InsertEntry("Order", orderId, null, null, null, null));

            var second = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(InsertEntry("Order", orderId, null, null, null, null)));

            second.Message.ShouldContain("UX_GalleryEntries_OrderId");
            var lineId = await FirstLineAsync();
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, null));
            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, null));
        }
        finally
        {
            await ExecuteAsync("DELETE FROM dbo.GalleryEntries");
        }
    }

    [Fact]
    public async Task RemovingAnOrderRemovesItsEntryAndALineAnOrderOrEntryUsesCannotBeDeleted()
    {
        await database.ResetAsync();
        var orderId = Guid.NewGuid();
        var lineId = Guid.NewGuid();
        await ExecuteAsync(InsertLineSql(lineId, "sample-restrict-line"));
        try
        {
            await ExecuteAsync(InsertOrderSql(orderId, "T-GAL-0003"));
            await ExecuteAsync(InsertEntry("Order", orderId, null, null, null, null));
            await ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"UPDATE dbo.Orders SET PublicProductLineId = '{lineId}' WHERE Id = '{orderId}'"));

            var inUseByOrder = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"DELETE FROM dbo.ProductLines WHERE Id = '{lineId}'")));
            inUseByOrder.Number.ShouldBe(547);

            await ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"DELETE FROM dbo.Orders WHERE Id = '{orderId}'"));
            (await ScalarAsync("SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(0);

            await ExecuteAsync(InsertEntry("Upload", null, "sample-photo-id", "Sample Team", lineId, null));
            var inUseByEntry = await Should.ThrowAsync<SqlException>(() => ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"DELETE FROM dbo.ProductLines WHERE Id = '{lineId}'")));
            inUseByEntry.Number.ShouldBe(547);
        }
        finally
        {
            await ExecuteAsync("DELETE FROM dbo.GalleryEntries");
            await ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"DELETE FROM dbo.Orders WHERE Id = '{orderId}'"));
            await ExecuteAsync(string.Create(CultureInfo.InvariantCulture, $"DELETE FROM dbo.ProductLines WHERE Id = '{lineId}'"));
        }
    }

    [Fact]
    public async Task TheGalleryTableHasNoTriggerNoJsonColumnAndNoSeededRow()
    {
        await database.ResetAsync();

        (await ScalarAsync("SELECT COUNT(*) FROM sys.tables WHERE name = N'GalleryEntries'")).ShouldBe(1);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.GalleryEntries')")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.triggers WHERE parent_id = OBJECT_ID(N'dbo.Orders')")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id WHERE c.object_id = OBJECT_ID(N'dbo.GalleryEntries') AND t.name = N'json'")).ShouldBe(0);
        (await ScalarAsync("SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(0);
    }

    [Fact]
    public async Task TheIdempotentScriptOnlyAddsColumnsCreatesOneTableAndRunsTwice()
    {
        var empty = await CspsDatabase.CreateEmptyAsync(SqlCompatibility.Level);
        await using (empty)
        {
            var context = empty.CreateContext();
            await using (context)
            {
                var migrator = context.GetService<IMigrator>();
                var all = context.Database.GetMigrations().ToList();
                var index = all.FindIndex(id => id.EndsWith("_AddOrderPublicSettings", StringComparison.Ordinal));
                index.ShouldBeGreaterThan(0);
                var before = all[index - 1];
                await migrator.MigrateAsync(before, TestContext.Current.CancellationToken);
                var script = migrator.GenerateScript(fromMigration: before, toMigration: all[index], options: MigrationsSqlGenerationOptions.Idempotent);

                script.ShouldContain(all[index]);
                script.ShouldContain("CREATE TABLE [GalleryEntries]");
                script.ShouldContain("CK_GalleryEntries_Kind");
                script.ShouldContain("CK_GalleryEntries_Pieces");
                script.ShouldContain("ALTER TABLE [Orders] ADD [PublicConsentAtUtc]");
                script.ShouldNotContain("CREATE TRIGGER", Case.Insensitive);
                script.ShouldNotContain("DROP ", Case.Insensitive);
                script.ShouldNotContain("INSERT INTO [Orders]", Case.Insensitive);
                script.ShouldNotContain("INSERT INTO [GalleryEntries]", Case.Insensitive);
                script.ShouldNotContain("UPDATE [Orders]", Case.Insensitive);
                await ApplyAsync(empty.ConnectionString, script);
                await ApplyAsync(empty.ConnectionString, script);
            }

            (await ScalarAsync(empty.ConnectionString, "SELECT COUNT(*) FROM dbo.GalleryEntries")).ShouldBe(0);
        }
    }

    [Fact]
    public async Task UndoingTheMigrationIsRefusedBecauseItWouldDeleteTheConsentRecord()
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
                var before = all[all.FindIndex(id => id.EndsWith("_AddOrderPublicSettings", StringComparison.Ordinal)) - 1];

                await Should.ThrowAsync<NotSupportedException>(() => migrator.MigrateAsync(before, TestContext.Current.CancellationToken));
            }
        }
    }

    private static string InsertOrderSql(Guid id, string number) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.Orders (Id, Number, CustomerName, OrderDate, Status, StatusChangedAtUtc, Subtotal, DiscountTotal, Total, PaidTotal, RefundedTotal, Balance, CustomerCredit, ExpensesTotal, Profit, FullyPaid, EditVersion, CreatedAtUtc) VALUES ('{id}', N'{number}', N'Sample', '2026-10-28', 1, SYSUTCDATETIME(), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, NEWID(), SYSUTCDATETIME())");

    private static string InsertLineSql(Guid id, string key) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.ProductLines (Id, [Key], Title, ShortName, Number, CardText, Description, FabricText, CollarText, CutText, NamesText, LogosText, Position, IsActive, PlaceholderArt, CreatedAtUtc) VALUES ('{id}', N'{key}', N'Sample line', N'Sample', N'1', N'Card', N'Description', N'Fabric', N'Collar', N'Cut', N'Names', N'Logos', 99, 0, 'Basketball', SYSDATETIMEOFFSET())");

    private static string InsertEntry(string kind, Guid? orderId, string? publicId, string? team, Guid? lineId, int? pieces) =>
        string.Create(
            CultureInfo.InvariantCulture,
            $"INSERT INTO dbo.GalleryEntries (Id, Kind, OrderId, Position, PublicId, TeamName, ProductLineId, Pieces, IsShown, CreatedAtUtc) VALUES (NEWID(), '{kind}', {Literal(orderId)}, 0, {LiteralText(publicId)}, {LiteralText(team)}, {Literal(lineId)}, {Literal(pieces)}, 1, SYSDATETIMEOFFSET())");

    private static string Literal(Guid? value) => value is null ? "NULL" : $"'{value}'";

    private static string LiteralText(string? value) => value is null ? "NULL" : $"N'{value}'";

    private static string Literal(int? value) => value is null ? "NULL" : value.Value.ToString(CultureInfo.InvariantCulture);

    private async Task<Guid> FirstLineAsync()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = "SELECT TOP 1 Id FROM dbo.ProductLines ORDER BY Position";
                return (Guid)(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken))!;
            }
        }
    }

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
