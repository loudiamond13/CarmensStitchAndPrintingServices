using System.Text;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>
/// FND-04 (D-30): the seed-step runner and the SiteSettings step against a migrated CSPS_Test database. The CLI
/// guard is bypassed here on purpose; it has its own tests. Every test brings the row to its own start state, so
/// the order the tests run in does not matter.
/// </summary>
public sealed class DevSeederTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 8, 1, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task SeedsSiteSettingsOnMigratedDatabase()
    {
        await ExecuteAsync("UPDATE dbo.SiteSettings SET BusinessName = N'Somebody Else''s Shop', ContactEmail = N'real@example.com' WHERE Id = 1;");

        var results = await RunSeedAsync();

        var result = results.ShouldHaveSingleItem();
        result.Name.ShouldBe("SiteSettings");
        result.Order.ShouldBe(100);
        result.Changed.ShouldBeTrue();

        var row = await ReadRowAsync();
        row.ShouldNotBeNull();
        row.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
        row.TimeZoneId.ShouldBe(SiteSettingsDefaults.TimeZoneId);
        row.CurrencyCode.ShouldBe(SiteSettingsDefaults.CurrencyCode);
        row.Locale.ShouldBe(SiteSettingsDefaults.Locale);
        row.ContactEmail.ShouldBe(SiteSettingsDefaults.ContactEmail);
        row.ContactPhone.ShouldBe(SiteSettingsDefaults.ContactPhone);
        row.AddressLine.ShouldBe(SiteSettingsDefaults.AddressLine);
        row.FacebookUrl.ShouldBe(SiteSettingsDefaults.FacebookUrl);
        row.UpdatedAtUtc.ShouldBe(Now);
    }

    [Fact]
    public async Task BusinessNameRoundTripsByteExact()
    {
        await ExecuteAsync("UPDATE dbo.SiteSettings SET BusinessName = N'x' WHERE Id = 1;");

        await RunSeedAsync();

        var row = await ReadRowAsync();
        row.ShouldNotBeNull();
        Encoding.Unicode.GetBytes(row.BusinessName).ShouldBe(Encoding.Unicode.GetBytes("Carmen's Stitch & Printing Services"));
    }

    [Fact]
    public async Task SecondRunChangesNothing()
    {
        await RunSeedAsync();
        var before = await ReadRowAsync();
        before.ShouldNotBeNull();

        var results = await RunSeedAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeFalse();
        var after = await ReadRowAsync();
        after.ShouldNotBeNull();
        after.RowVersion.ShouldBe(before.RowVersion);
        after.UpdatedAtUtc.ShouldBe(before.UpdatedAtUtc);
    }

    [Fact]
    public async Task RecreatesMissingRow()
    {
        await ExecuteAsync("DELETE FROM dbo.SiteSettings;");

        var results = await RunSeedAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeTrue();
        var row = await ReadRowAsync();
        row.ShouldNotBeNull();
        row.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
        row.ContactPhone.ShouldBe(SiteSettingsDefaults.ContactPhone);
        row.CreatedAtUtc.ShouldBe(Now);
        row.UpdatedAtUtc.ShouldBeNull();
    }

    [Fact]
    public async Task RunsStepsInAscendingOrder()
    {
        var log = new List<string>();
        ISeedStep[] steps = [new RecordingStep(300, "third", log), new RecordingStep(100, "first", log), new RecordingStep(200, "second", log)];

        var context = database.CreateContext();
        await using (context)
        {
            var results = await new DevSeeder(steps, new FakeTimeProvider(Now)).RunAsync(context, TestContext.Current.CancellationToken);

            log.ShouldBe(["first", "second", "third"]);
            results.Select(result => result.Order).ShouldBe([100, 200, 300]);
            results.ShouldAllBe(result => result.Changed);
        }
    }

    [Fact]
    public async Task RejectsDuplicateOrder()
    {
        var log = new List<string>();
        ISeedStep[] steps = [new RecordingStep(50, "early", log), new RecordingStep(100, "a", log), new RecordingStep(100, "b", log)];

        var context = database.CreateContext();
        await using (context)
        {
            var seeder = new DevSeeder(steps, new FakeTimeProvider(Now));

            var error = await Should.ThrowAsync<InvalidOperationException>(
                () => seeder.RunAsync(context, TestContext.Current.CancellationToken));

            error.Message.ShouldContain("100");
            log.ShouldBeEmpty("No step may run when the order is ambiguous.");
        }
    }

    [Fact]
    public void TheOrdersStepRunsAfterTheCompanyExpensesStepWithItsOwnOrder()
    {
        DevSeedSteps.All.Select(step => step.Order).ShouldBeUnique();
        var orders = DevSeedSteps.All.OfType<OrdersSeedStep>().ShouldHaveSingleItem();
        var expenses = DevSeedSteps.All.OfType<CompanyExpensesSeedStep>().ShouldHaveSingleItem();
        orders.Order.ShouldBeGreaterThan(expenses.Order);
        orders.Name.ShouldBe("Orders");
    }

    private async Task<IReadOnlyList<SeedStepResult>> RunSeedAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await new DevSeeder(DevSeedSteps.All.Where(step => step.Name == "SiteSettings"), new FakeTimeProvider(Now))
                .RunAsync(context, TestContext.Current.CancellationToken);
        }
    }

    private async Task ExecuteAsync(string sql)
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }

    private async Task<SiteSettingsRow?> ReadRowAsync()
    {
        var connection = new SqlConnection(database.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText =
                    "SELECT BusinessName, TimeZoneId, CurrencyCode, Locale, ContactEmail, ContactPhone, AddressLine, FacebookUrl, "
                    + "CreatedAtUtc, UpdatedAtUtc, RowVersion FROM dbo.SiteSettings WHERE Id = 1;";
                var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
                await using (reader)
                {
                    if (!await reader.ReadAsync(TestContext.Current.CancellationToken))
                    {
                        return null;
                    }

                    return new SiteSettingsRow(
                        reader.GetString(0),
                        reader.GetString(1),
                        reader.GetString(2),
                        reader.GetString(3),
                        reader.GetString(4),
                        reader.GetString(5),
                        reader.GetString(6),
                        reader.GetString(7),
                        reader.GetFieldValue<DateTimeOffset>(8),
                        reader.IsDBNull(9) ? null : reader.GetFieldValue<DateTimeOffset>(9),
                        reader.GetFieldValue<byte[]>(10));
                }
            }
        }
    }

    private sealed record SiteSettingsRow(
        string BusinessName,
        string TimeZoneId,
        string CurrencyCode,
        string Locale,
        string ContactEmail,
        string ContactPhone,
        string AddressLine,
        string FacebookUrl,
        DateTimeOffset CreatedAtUtc,
        DateTimeOffset? UpdatedAtUtc,
        byte[] RowVersion);

    private sealed class RecordingStep(int order, string name, List<string> log) : ISeedStep
    {
        public int Order => order;

        public string Name => name;

        public Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
        {
            log.Add(name);
            return Task.FromResult(true);
        }
    }
}
