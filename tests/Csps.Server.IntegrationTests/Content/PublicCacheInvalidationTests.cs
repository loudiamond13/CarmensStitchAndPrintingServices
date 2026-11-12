using System.Net;
using System.Text.Json;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// PUB-03, CONT-05: the first public read after a committed content change returns the new value with a new ETag, and an old ETag no
/// longer earns a 304. The change goes through the host's own context, so its interceptors run.
/// </summary>
public sealed class PublicCacheInvalidationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/public/site";
    private static readonly DateTimeOffset Later = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheFirstReadAfterACommittedChangeShowsTheNewTaglineAndANewETag()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();

        await ChangeAsync(factory, PublicContentSeeding.Demo("Second line"));

        using var second = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("tagline").GetString().ShouldBe("Second line");
        second.Headers.ETag.ShouldNotBeNull().ShouldNotBe(oldEtag);
    }

    [Fact]
    public async Task TheOldETagNoLongerGets304AfterAChange()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();
        await ChangeAsync(factory, PublicContentSeeding.Demo("Second line"));
        using var request = ApiRequests.Get(Route);
        request.Headers.TryAddWithoutValidation("If-None-Match", oldEtag.ToString());

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ANewPhoneNumberShowsOnTheNextRead()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        (await PhoneCountAsync(client)).ShouldBe(2);

        await ChangeAsync(
            factory,
            PublicContentSeeding.Demo() with
            {
                Phones = [.. PublicContentSeeding.Demo().Phones, new Csps.Domain.Content.BusinessPhone("0918 123 4567", "Smart", IsMain: false)],
            });

        (await PhoneCountAsync(client)).ShouldBe(3);
    }

    [Fact]
    public async Task AnHoursSaveShowsOnTheNextSiteReadWithANewETagAndTheOpenStatusFollows()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveHoursAsync(database, PublicContentSeeding.DemoWeek);
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);

        // Monday 16 Nov 2026, 10:00 in Manila.
        await using var factory = AuthClient.WithClock(baseFactory, new FakeTimeProvider(new DateTimeOffset(2026, 11, 16, 2, 0, 0, TimeSpan.Zero)));
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();
        (await OpenNowAsync(client)).ShouldBeTrue();

        var elevenToSixOnMonday = PublicContentSeeding.DemoWeek.Select(day => day.Day == 1 ? (day.Day, (TimeOnly?)new TimeOnly(11, 0), (TimeOnly?)new TimeOnly(18, 0)) : day).ToList();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            await PublicContentSeeding.SaveHoursAsync(context, elevenToSixOnMonday);
        }

        using var second = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("hours")[0].GetProperty("opensAt").GetString().ShouldBe("11:00");
        second.Headers.ETag.ShouldNotBeNull().ShouldNotBe(oldEtag);
        (await OpenNowAsync(client)).ShouldBeFalse();
    }

    [Fact]
    public async Task AddingEditingAndDeletingAClosureEachChangeTheSiteETagOnTheNextRead()
    {
        var today = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await PublicContentSeeding.SaveClosuresAsync(database, []);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        var etags = new List<string> { await ETagAsync(client) };

        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            await PublicContentSeeding.SaveClosuresAsync(context, [(today.AddDays(5), null, "Holiday")]);
        }

        etags.Add(await ETagAsync(client));
        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            var closure = await context.ShopClosures.SingleAsync(TestContext.Current.CancellationToken);
            closure.Change(today.AddDays(5), today.AddDays(6), "Holiday", today).IsSuccess.ShouldBeTrue();
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        etags.Add(await ETagAsync(client));
        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            context.ShopClosures.Remove(await context.ShopClosures.SingleAsync(TestContext.Current.CancellationToken));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        etags.Add(await ETagAsync(client));
        etags.Distinct().Count().ShouldBe(3, "an add and a delete of the same closure end where they started; each step must move the ETag");
        etags[3].ShouldBe(etags[0]);
        etags[1].ShouldNotBe(etags[0]);
        etags[2].ShouldNotBe(etags[1]);
        etags[3].ShouldNotBe(etags[2]);
    }

    [Fact]
    public async Task ChangingAProductLineTitleShowsOnTheNextLinesReadWithANewETagAndTheOldETagGetsNo304()
    {
        const string LinesRoute = "/api/v1/public/product-lines";
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(LinesRoute, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();

        try
        {
            await SetTitleAsync(contexts, "Basketball Jerseys", "Basketball Kits");

            using var second = await client.GetAsync(new Uri(LinesRoute, UriKind.Relative), TestContext.Current.CancellationToken);
            using var document = JsonDocument.Parse(await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
            document.RootElement.GetProperty("lines")[0].GetProperty("title").GetString().ShouldBe("Basketball Kits");
            second.Headers.ETag.ShouldNotBeNull().ShouldNotBe(oldEtag);
            using var stale = ApiRequests.Get(LinesRoute);
            stale.Headers.TryAddWithoutValidation("If-None-Match", oldEtag.ToString());
            using var response = await client.SendAsync(stale, TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK);
        }
        finally
        {
            await SetTitleAsync(contexts, "Basketball Kits", "Basketball Jerseys");
        }
    }

    [Fact]
    public async Task FilingAProductTypeUnderALineClearsThePublicCache()
    {
        const string LinesRoute = "/api/v1/public/product-lines";
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        try
        {
            (await BasketballPriceAsync(client, LinesRoute)).ShouldBeNull();

            // A save through a context that is not wired to the host's cache leaves the cached answer as it was.
            await using (var plain = database.CreateContext())
            {
                var line = await plain.ProductLines.SingleAsync(row => row.Key == "basketball", TestContext.Current.CancellationToken);
                line.ResetToSeed(Csps.Domain.Content.ProductLineSeed.All[0], 650.00m, 10);
                await plain.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            (await BasketballPriceAsync(client, LinesRoute)).ShouldBeNull("the cache still holds the old answer");

            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                var line = await context.ProductLines.AsNoTracking().SingleAsync(row => row.Key == "basketball", TestContext.Current.CancellationToken);
                var type = await context.ProductTypes.FirstAsync(TestContext.Current.CancellationToken);
                type.LinkToLine(line.Id).ShouldBeTrue();
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            (await BasketballPriceAsync(client, LinesRoute)).ShouldBe(650.00m, "a saved product type link clears the public cache");
        }
        finally
        {
            await database.ResetAsync();
            await ProductLineSeeding.RestoreSixAsync(database);
        }
    }

    private static async Task<decimal?> BasketballPriceAsync(HttpClient client, string route)
    {
        using var response = await client.GetAsync(new Uri(route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var price = document.RootElement.GetProperty("lines")[0].GetProperty("startsAtPrice");
        return price.ValueKind == JsonValueKind.Null ? null : price.GetDecimal();
    }

    private static async Task SetTitleAsync(IDbContextFactory<CspsDbContext> contexts, string from, string to)
    {
        await using var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken);
        var line = await context.ProductLines.SingleAsync(row => row.Title == from, TestContext.Current.CancellationToken);
        context.Entry(line).Property(row => row.Title).CurrentValue = to;
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<string> ETagAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        return response.Headers.ETag.ShouldNotBeNull().ToString();
    }

    private static async Task<bool> OpenNowAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri("/api/v1/public/open-status", UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("isOpen").GetBoolean();
    }

    private static async Task ChangeAsync(CspsApiFactory factory, Csps.Domain.Content.BusinessInfo info)
    {
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        await using var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken);
        await PublicContentSeeding.SaveAsync(context, info, Later);
    }

    private static async Task<int> PhoneCountAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("phones").GetArrayLength();
    }
}
