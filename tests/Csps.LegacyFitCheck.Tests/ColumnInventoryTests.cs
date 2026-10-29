using System.Text.RegularExpressions;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;
using Csps.Testing;
using Microsoft.Extensions.Time.Testing;

namespace Csps.LegacyFitCheck.Tests;

public sealed class ColumnInventoryTests
{
    [Fact]
    public async Task AFakeRunListsNoUnknownColumns()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var text = await RunAndReadFindingsAsync(fake, token);

            Regex.IsMatch(text, @"Column inventory: 43 columns read, 0 unknown, 0 missing").ShouldBeTrue(text);
            text.ShouldNotContain("column.unknown");
            text.ShouldNotContain("column.missing");
            Line(text, "Orders.CreatedBy").ShouldContain("NotChecked");
            Line(text, "Orders.CreatedBy").ShouldContain("creator attribution, Phase 15");
            Line(text, "Payments.UpdatedBy").ShouldContain("NotChecked");
            Line(text, "Payments.UpdatedBy").ShouldContain("creator attribution, Phase 15");
        }
    }

    [Fact]
    public async Task AnUnknownColumnIsCannotMap()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token, new ShadowColumn("Orders", "MysteryColumn"));
        await using (fake.ConfigureAwait(true))
        {
            var text = await RunAndReadFindingsAsync(fake, token);

            var unknown = text.Split('\n').Where(static line => line.Contains("column.unknown", StringComparison.Ordinal)).ShouldHaveSingleItem();
            unknown.ShouldContain("CannotMap");
            unknown.ShouldContain("Orders.MysteryColumn");
            text.ShouldContain("1 unknown, 0 missing");
        }
    }

    [Fact]
    public async Task AMappedColumnMissingFromTheRestoreStopsTheRunBeforeAnyTableIsRead()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderMissingAsync(new ShadowColumn("Orders", "Note"), token);
        await using (fake.ConfigureAwait(true))
        {
            var server = await SqlServerInstance.GetSharedAsync();
            var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
            var localRoot = Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");
            var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
            using var output = new StringWriter();
            using var error = new StringWriter();
            var trialCreated = false;
            var hooks = new FitCheckHooks((_, _) =>
            {
                trialCreated = true;
                return Task.CompletedTask;
            });

            try
            {
                var exit = await FitCheckRunner.RunAsync(targets, localRoot, time, output, error, token, hooks);

                exit.ShouldBe(1);
                error.ToString().TrimEnd().ShouldBe("Failed: mapped columns missing from the restore: 1. No table was read.");
                output.ToString().ShouldContain("_local/legacy-fit-check/findings-");
                output.ToString().ShouldNotContain("SENTINEL");
                trialCreated.ShouldBeFalse();

                var folder = Path.Combine(localRoot, "legacy-fit-check");
                var text = await File.ReadAllTextAsync(Directory.EnumerateFiles(folder, "findings-*.md").ShouldHaveSingleItem(), token);
                var missing = text.Split('\n').Where(static line => line.Contains("column.missing", StringComparison.Ordinal)).ShouldHaveSingleItem();
                missing.ShouldContain("CannotMap");
                missing.ShouldContain("Orders.Note");
                text.ShouldContain("0 unknown, 1 missing");
                text.ShouldNotContain("SENTINEL");
                Directory.EnumerateFiles(folder, "summary-*.md").ShouldBeEmpty();
            }
            finally
            {
                var root = Path.GetDirectoryName(localRoot);
                if (root is not null && Directory.Exists(root))
                {
                    Directory.Delete(root, recursive: true);
                }
            }
        }
    }

    [Fact]
    public void TheFullResearchColumnSetGivesNoUnknownAndNoMissingColumn()
    {
        var result = ColumnInventory.Check(ResearchColumns());

        result.Unknown.ShouldBe(0);
        result.Missing.ShouldBe(0);
        result.Findings.ShouldNotContain(static finding => finding.RuleKey == "column.unknown" || finding.RuleKey == "column.missing");
        result.ColumnsRead.ShouldBe(ResearchColumns().Count(static column => DraftColumnMap.Tables.Contains(column.TableName)));
    }

    [Fact]
    public void ADroppedMappedColumnIsOneMissingFinding()
    {
        var columns = ResearchColumns().Where(static column => !(column.TableName == "Payments" && column.ColumnName == "Amount")).ToList();

        var result = ColumnInventory.Check(columns);

        result.Missing.ShouldBe(1);
        var finding = result.Findings.Where(static finding => finding.RuleKey == "column.missing").ShouldHaveSingleItem();
        finding.Type.ShouldBe(FindingType.CannotMap);
        finding.Path.ShouldBe("Payments.Amount");
        finding.Kind.ShouldBe(RecordKind.Column);
    }

    [Fact]
    public void ADroppedNotMappedColumnIsNotMissing()
    {
        var columns = ResearchColumns().Where(static column => !(column.TableName == "Orders" && column.ColumnName == "CreatedBy")).ToList();

        var result = ColumnInventory.Check(columns);

        result.Missing.ShouldBe(0);
        result.Findings.ShouldNotContain(static finding => finding.Path == "Orders.CreatedBy");
    }

    [Fact]
    public void AColumnInATableOutsideTheSevenIsIgnored()
    {
        List<LegacyColumn> columns =
        [
            .. ResearchColumns(),
            Column("OrderImages", "ImageUrl"),
            Column("MoneyTransfers", "TransferAmount"),
            Column("AspNetUsers", "PhoneNumber"),
            Column("__EFMigrationsHistory", "MigrationId"),
        ];

        var result = ColumnInventory.Check(columns);

        result.Unknown.ShouldBe(0);
        result.ColumnsRead.ShouldBe(ResearchColumns().Count(static column => DraftColumnMap.Tables.Contains(column.TableName)));
        result.Findings.ShouldNotContain(static finding => finding.Path != null && (finding.Path.StartsWith("OrderImages", StringComparison.Ordinal) || finding.Path.StartsWith("AspNet", StringComparison.Ordinal)));
    }

    [Fact]
    public void AnUnknownColumnInASevenTableIsCannotMapWithTheDataType()
    {
        var result = ColumnInventory.Check([.. ResearchColumns(), Column("Expenses", "Category", "int")]);

        result.Unknown.ShouldBe(1);
        var finding = result.Findings.Where(static finding => finding.RuleKey == "column.unknown").ShouldHaveSingleItem();
        finding.Type.ShouldBe(FindingType.CannotMap);
        finding.Path.ShouldBe("Expenses.Category");
        finding.Detail.ShouldNotBeNull().ShouldContain("int");
    }

    [Fact]
    public void MatchingIsCaseInsensitiveOnTableAndColumn()
    {
        var changed = ResearchColumns()
            .Select(static column => new LegacyColumn { TableSchema = column.TableSchema, TableName = column.TableName.ToUpperInvariant(), ColumnName = column.ColumnName.ToLowerInvariant(), DataType = column.DataType })
            .ToList();

        var result = ColumnInventory.Check(changed);

        result.Unknown.ShouldBe(0);
        result.Missing.ShouldBe(0);
    }

    [Fact]
    public void EveryPresentNotMappedColumnGetsItsReasonAndType()
    {
        var result = ColumnInventory.Check(ResearchColumns());

        var notMapped = DraftColumnMap.Entries.Where(static entry => !entry.IsMapped).ToList();
        result.Findings.Count(static finding => finding.RuleKey == "column.not-mapped").ShouldBe(notMapped.Count);
        foreach (var entry in notMapped)
        {
            var finding = result.Findings.Single(finding => finding.RuleKey == "column.not-mapped" && finding.Path == entry.Path);
            finding.Type.ShouldBe(entry.Type!.Value);
            finding.Message.ShouldBe(entry.Reason);
        }

        TypeOf(result, "OrderItems.IsDone").ShouldBe(FindingType.CannotMap);
        TypeOf(result, "Discounts.DiscountedBy").ShouldBe(FindingType.CannotMap);
        TypeOf(result, "Statuses.StatusCategory").ShouldBe(FindingType.CannotMap);
        TypeOf(result, "Orders.DeletedBy").ShouldBe(FindingType.NotChecked);
        TypeOf(result, "Expenses.UpdatedDate").ShouldBe(FindingType.NotChecked);
        TypeOf(result, "Discounts.UpdateDate").ShouldBe(FindingType.NotChecked);
    }

    [Fact]
    public void EveryDraftMapEntryHasATargetOrAReason()
    {
        DraftColumnMap.Entries.ShouldNotBeEmpty();
        foreach (var entry in DraftColumnMap.Entries)
        {
            if (entry.IsMapped)
            {
                string.IsNullOrWhiteSpace(entry.Target).ShouldBeFalse(entry.Path);
                entry.Reason.ShouldBeNull(entry.Path);
                entry.Type.ShouldBeNull(entry.Path);
            }
            else
            {
                string.IsNullOrWhiteSpace(entry.Reason).ShouldBeFalse(entry.Path);
                entry.Type.ShouldBeOneOf(FindingType.CannotMap, FindingType.NotChecked);
            }
        }

        DraftColumnMap.Entries.Select(static entry => entry.Path.ToUpperInvariant()).Distinct().Count().ShouldBe(DraftColumnMap.Entries.Count);
        DraftColumnMap.Entries.Select(static entry => entry.Table).Distinct().Order().ShouldBe(DraftColumnMap.Tables.Order());
        DraftColumnMap.PeopleTables.ShouldBe(["AspNetUsers", "AspNetRoles", "AspNetUserRoles"]);
        DraftColumnMap.PeopleTablesReason.ShouldContain("D-09");
    }

    private static FindingType TypeOf(ColumnInventoryResult result, string path) =>
        result.Findings.Single(finding => finding.Path == path).Type;

    private static LegacyColumn Column(string table, string column, string type = "nvarchar") =>
        new() { TableSchema = "dbo", TableName = table, ColumnName = column, DataType = type };

    // Every column of the in-scope tables as named in 07.1-RESEARCH, plus the people tables the check leaves out.
    private static List<LegacyColumn> ResearchColumns()
    {
        (string Table, string[] Columns)[] tables =
        [
            ("Orders", ["OrderId", "OrderName", "OrderDate", "TotalAmount", "Note", "CreatedBy", "UpdatedBy", "DeletedBy", "IsDeleted", "PaidAmount", "TotalDiscount", "TotalBalance", "TotalExpenses", "OrderTypeId", "StatusId"]),
            ("OrderItems", ["OrderItemId", "OrderId", "Description", "Quantity", "Price", "IsDone", "CreatedBy", "UpdatedBy", "UpdatedDate", "CreatedDate"]),
            ("Payments", ["PaymentId", "OrderId", "PaymentDate", "PaidBy", "CreatedBy", "UpdatedBy", "DeletedBy", "IsDeleted", "Amount", "PaidTo", "UpdatedDate"]),
            ("Discounts", ["OrderDiscountId", "OrderId", "Description", "Amount", "DiscountedBy", "UpdatedBy", "DiscountDate", "UpdateDate"]),
            ("Expenses", ["ExpenseId", "OrderId", "Description", "SpentDate", "isCompanyExpenses", "Amount", "PaidBy", "UpdatedBy", "UpdatedDate"]),
            ("OrderTypes", ["OrderTypeId", "OrderTypeName"]),
            ("Statuses", ["StatusId", "StatusName", "StatusCategory"]),
            ("AspNetUsers", ["Id", "UserName", "Email", "FirstName", "LastName", "CodeSentAt", "LoginVerificationCode"]),
            ("AspNetRoles", ["Id", "Name"]),
            ("AspNetUserRoles", ["UserId", "RoleId"]),
        ];
        return [.. tables.SelectMany(static table => table.Columns.Select(column => Column(table.Table, column)))];
    }

    private static string Line(string text, string path) =>
        text.Split('\n').Where(line => line.Contains(path, StringComparison.Ordinal)).ShouldHaveSingleItem();

    private static async Task<string> RunAndReadFindingsAsync(FakeLegacyDatabase fake, CancellationToken token)
    {
        var server = await SqlServerInstance.GetSharedAsync();
        var targets = new FitCheckTargets(fake.ConnectionString, server.MasterConnectionString);
        var localRoot = Path.Combine(Path.GetTempPath(), $"csps-fitcheck-{Guid.NewGuid():N}", "_local");
        var time = new FakeTimeProvider(new DateTimeOffset(2026, 10, 29, 0, 0, 0, TimeSpan.Zero));
        using var output = new StringWriter();
        using var error = new StringWriter();
        try
        {
            var exit = await FitCheckRunner.RunAsync(targets, localRoot, time, output, error, token);

            exit.ShouldBe(0, error.ToString());
            var file = Directory.EnumerateFiles(Path.Combine(localRoot, "legacy-fit-check"), "findings-*.md").ShouldHaveSingleItem();
            return await File.ReadAllTextAsync(file, token);
        }
        finally
        {
            var root = Path.GetDirectoryName(localRoot);
            if (root is not null && Directory.Exists(root))
            {
                Directory.Delete(root, recursive: true);
            }
        }
    }
}
