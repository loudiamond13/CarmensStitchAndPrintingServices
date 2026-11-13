using System.Text;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
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

    [Fact]
    public void TheSiteContentStepRunsAfterTheOrdersStepWithItsOwnOrder()
    {
        DevSeedSteps.All.Select(step => step.Order).ShouldBeUnique();
        var orders = DevSeedSteps.All.Single(step => step.Name == "Orders");

        var content = DevSeedSteps.All.SingleOrDefault(step => step.Name == "SiteContent");

        content.ShouldNotBeNull();
        content.Order.ShouldBeGreaterThan(orders.Order);
    }

    [Fact]
    public async Task TheSiteContentStepFillsADemoPublicSite()
    {
        await StartWithAnEmptyPublicSiteAsync();

        var results = await RunStepsAsync("Orders", "SiteContent");

        results.Select(result => result.Name).ShouldBe(["Orders", "SiteContent"]);
        results.ShouldAllBe(result => result.Changed);

        var context = database.CreateContext();
        await using (context)
        {
            var settings = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
            settings.BusinessName.ShouldBe(SiteSettingsDefaults.BusinessName);
            settings.Street.ShouldNotBeNullOrWhiteSpace();
            settings.TownOrCity.ShouldNotBeNullOrWhiteSpace();
            settings.MessengerUrl.ShouldNotBeNullOrWhiteSpace();

            var phones = await context.SitePhoneNumbers.AsNoTracking().OrderBy(phone => phone.Position).ToListAsync(TestContext.Current.CancellationToken);
            phones.Count.ShouldBe(2);
            phones[0].IsMain.ShouldBeTrue();
            phones.Count(phone => phone.IsMain).ShouldBe(1);

            var week = await context.OpeningHours.AsNoTracking().OrderBy(day => day.DayOfWeek).ToListAsync(TestContext.Current.CancellationToken);
            week.Select(day => day.DayOfWeek).ShouldBe([1, 2, 3, 4, 5, 6, 7]);
            week.Take(6).ShouldAllBe(day => day.OpensAt == new TimeOnly(9, 0) && day.ClosesAt == new TimeOnly(18, 0));
            week[6].OpensAt.ShouldBeNull();
            week[6].ClosesAt.ShouldBeNull();

            var closure = (await context.ShopClosures.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem();
            closure.FirstDay.ShouldBe(new DateOnly(2026, 10, 28));

            var lines = await context.ProductLines.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
            lines.Where(line => line.StartsAtPrice is not null).Select(line => line.Key).Order().ShouldBe(["basketball", "volleyball"]);
            lines.Single(line => line.Key == "basketball").StartsAtPrice!.Value.ShouldBeGreaterThan(0m);
            lines.Single(line => line.Key == "basketball").MinimumQuantity.ShouldNotBeNull();

            var testimonials = await context.Testimonials.AsNoTracking().OrderBy(testimonial => testimonial.Position).ToListAsync(TestContext.Current.CancellationToken);
            testimonials.Count.ShouldBe(3);
            testimonials.ShouldAllBe(testimonial => testimonial.IsShown);

            var shown = (await context.Orders.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).Where(order => order.IsShownOnWebsite).ToList();
            shown.Count.ShouldBeGreaterThanOrEqualTo(2);
            shown.ShouldAllBe(order => order.HasCustomerConsent);
            var entries = await context.GalleryEntries.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
            entries.Select(entry => entry.OrderId).Order().ShouldBe(shown.Select(order => (Guid?)order.Id).Order());
        }
    }

    [Fact]
    public async Task ASecondRunOfTheSiteContentStepChangesNothing()
    {
        await StartWithAnEmptyPublicSiteAsync();
        await RunStepsAsync("SiteSettings", "Orders", "SiteContent");
        var before = await CountPublicRowsAsync();

        var results = await RunStepsAsync("SiteSettings", "Orders", "SiteContent");

        results.Select(result => result.Name).ShouldBe(["SiteSettings", "Orders", "SiteContent"]);
        results.ShouldAllBe(result => !result.Changed);
        (await CountPublicRowsAsync()).ShouldBe(before);
    }

    [Fact]
    public async Task TheSiteContentStepKeepsWhatAManagerAlreadyEntered()
    {
        await StartWithAnEmptyPublicSiteAsync();
        var context = database.CreateContext();
        await using (context)
        {
            context.SitePhoneNumbers.Add(SitePhoneNumber.Create("0917 555 0100", "Own", isMain: true, 1, Now).Value);
            context.Testimonials.Add(Testimonial.Create(new TestimonialValues("Our own quote.", "Own Name", null, 4, true), 1, Now).Value);
            context.ShopClosures.Add(ShopClosure.Create(new DateOnly(2026, 12, 25), null, "Own closure", new DateOnly(2026, 10, 8), Now).Value);
            (await context.OpeningHours.SingleAsync(day => day.DayOfWeek == 1, TestContext.Current.CancellationToken)).SetHours(new TimeOnly(8, 0), new TimeOnly(12, 0)).IsSuccess.ShouldBeTrue();
            var basketball = await context.ProductLines.SingleAsync(line => line.Key == "basketball", TestContext.Current.CancellationToken);
            basketball.Update(new ProductLineValues(
                basketball.Title, basketball.ShortName, basketball.Number, basketball.CardText, basketball.Description, basketball.FabricText,
                basketball.CollarText, basketball.CutText, basketball.NamesText, basketball.LogosText, 500m, 5m, null)).IsSuccess.ShouldBeTrue();
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await RunStepsAsync("Orders", "SiteContent");

        var after = database.CreateContext();
        await using (after)
        {
            (await after.SitePhoneNumbers.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem().Label.ShouldBe("Own");
            (await after.Testimonials.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem().Name.ShouldBe("Own Name");
            (await after.ShopClosures.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken)).ShouldHaveSingleItem().Note.ShouldBe("Own closure");
            (await after.OpeningHours.AsNoTracking().SingleAsync(day => day.DayOfWeek == 1, TestContext.Current.CancellationToken)).OpensAt.ShouldBe(new TimeOnly(8, 0));
            (await after.ProductLines.AsNoTracking().SingleAsync(line => line.Key == "basketball", TestContext.Current.CancellationToken)).StartsAtPrice.ShouldBe(500m);
        }
    }

    // A freshly migrated database holds no phones, closures, testimonials, orders or gallery entries, a closed week and six lines with no
    // price. The week and the lines survive the reset helper, so they are put back here.
    private async Task StartWithAnEmptyPublicSiteAsync()
    {
        await database.ResetAsync();
        var context = database.CreateContext();
        await using (context)
        {
            foreach (var day in await context.OpeningHours.ToListAsync(TestContext.Current.CancellationToken))
            {
                day.SetHours(null, null).IsSuccess.ShouldBeTrue();
            }

            foreach (var line in await context.ProductLines.ToListAsync(TestContext.Current.CancellationToken))
            {
                line.ResetToSeed(ProductLineSeed.All.Single(entry => entry.Id == line.Id), null, null);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task<(int Phones, int Closures, int Testimonials, int Entries, int ShownOrders, int PricedLines, int OpenDays)> CountPublicRowsAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            var orders = await context.Orders.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
            var lines = await context.ProductLines.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
            var week = await context.OpeningHours.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
            return (
                await context.SitePhoneNumbers.CountAsync(TestContext.Current.CancellationToken),
                await context.ShopClosures.CountAsync(TestContext.Current.CancellationToken),
                await context.Testimonials.CountAsync(TestContext.Current.CancellationToken),
                await context.GalleryEntries.CountAsync(TestContext.Current.CancellationToken),
                orders.Count(order => order.IsShownOnWebsite),
                lines.Count(line => line.StartsAtPrice is not null),
                week.Count(day => day.OpensAt is not null));
        }
    }

    private async Task<IReadOnlyList<SeedStepResult>> RunStepsAsync(params string[] names)
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await new DevSeeder(DevSeedSteps.All.Where(step => names.Contains(step.Name)), new FakeTimeProvider(Now))
                .RunAsync(context, TestContext.Current.CancellationToken);
        }
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
