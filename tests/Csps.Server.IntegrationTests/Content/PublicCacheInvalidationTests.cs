using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
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

    // The writes in the order they are made. "cancel" runs on a second order, because it takes the first one off the website.
    private static readonly string[] OrderWriteNames =
    [
        "public settings save",
        "item add",
        "item quantity edit",
        "item delete",
        "team name change",
        "photo add",
        "second photo add",
        "cover change",
        "photo remove",
        "delete",
        "restore",
        "permanent delete",
        "cancel",
    ];

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
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
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

    [Fact]
    public async Task EveryTestimonialChangeAndAHiddenLineEachGiveANewHomeETagOnTheNextRead()
    {
        const string HomeRoute = "/api/v1/public/home";
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        var etags = new List<string> { await ETagAsync(client, HomeRoute) };
        try
        {
            Guid first;
            Guid second;
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                var ana = Csps.Domain.Content.Testimonial.Create(new Csps.Domain.Content.TestimonialValues("Quote from Ana.", "Ana", null, 5, true), 1, Later).Value;
                context.Testimonials.Add(ana);
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
                first = ana.Id;
            }

            etags.Add(await ETagAsync(client, HomeRoute));
            await ChangeTestimonialAsync(contexts, first, testimonial => testimonial.Update(new Csps.Domain.Content.TestimonialValues("A new quote from Ana.", "Ana", null, 5, null)));
            etags.Add(await ETagAsync(client, HomeRoute));
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                var ben = Csps.Domain.Content.Testimonial.Create(new Csps.Domain.Content.TestimonialValues("Quote from Ben.", "Ben", null, 4, true), 2, Later).Value;
                context.Testimonials.Add(ben);
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
                second = ben.Id;
            }

            etags.Add(await ETagAsync(client, HomeRoute));
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                var a = await context.Testimonials.SingleAsync(row => row.Id == first, TestContext.Current.CancellationToken);
                var b = await context.Testimonials.SingleAsync(row => row.Id == second, TestContext.Current.CancellationToken);
                a.SwapPositionWith(b);
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            etags.Add(await ETagAsync(client, HomeRoute));
            await ChangeTestimonialAsync(contexts, second, testimonial => testimonial.Hide());
            etags.Add(await ETagAsync(client, HomeRoute));
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                context.Testimonials.Remove(await context.Testimonials.SingleAsync(row => row.Id == first, TestContext.Current.CancellationToken));
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            etags.Add(await ETagAsync(client, HomeRoute));
            await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
            {
                (await context.ProductLines.SingleAsync(row => row.Key == "moto", TestContext.Current.CancellationToken)).Hide().ShouldBeTrue();
                await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            }

            etags.Add(await ETagAsync(client, HomeRoute));

            etags.Count.ShouldBe(8);
            etags.Zip(etags.Skip(1)).ShouldAllBe(pair => pair.First != pair.Second, "each add, edit, move, hide, delete and line hide must move the Home ETag");
        }
        finally
        {
            await database.ResetAsync();
            await ProductLineSeeding.RestoreSixAsync(database);
        }
    }

    [Fact]
    public async Task ShowingAPhotoAddOnAShownOrderTakingItOffAndALineHideEachGiveANewGalleryETagOnTheNextRead()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var etags = new List<string>();

        async Task StepAsync(Func<Task> write)
        {
            await write();
            var (document, etag) = await rig.GalleryAsync();
            document.Dispose();
            etags.Add(etag);
        }

        var (empty, firstEtag) = await rig.GalleryAsync();
        empty.Dispose();
        etags.Add(firstEtag);
        var created = await rig.CreateOrderAsync("Brgy. Sample Ballers", 10);
        var orderId = created.GetProperty("id").GetGuid();
        await rig.UploadPhotoAsync(orderId, 800, 600);
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: true));
        await StepAsync(() => rig.UploadPhotoAsync(orderId, 600, 800));
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: false));
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: true));
        await StepAsync(async () =>
        {
            using var response = await rig.HideLineAsync(PublicGalleryRig.LineId("basketball"));
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        });

        etags.Count.ShouldBe(6);
        etags.Zip(etags.Skip(1)).ShouldAllBe(pair => pair.First != pair.Second, "showing, a photo add on a shown order, taking off, showing again and hiding the line must each move the gallery ETag");
    }

    [Fact]
    public async Task ShowingACoverChangeTakingOffShowingAgainAndALineHideEachGiveANewHomeETagOnTheNextRead()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var etags = new List<string>();

        async Task StepAsync(Func<Task> write)
        {
            await write();
            var (document, etag) = await rig.PublicHomeAsync();
            document.Dispose();
            etags.Add(etag);
        }

        var created = await rig.CreateOrderAsync("Brgy. Sample Ballers", 10);
        var orderId = created.GetProperty("id").GetGuid();
        await rig.UploadPhotoAsync(orderId, 800, 600);
        await rig.UploadPhotoAsync(orderId, 600, 800);
        var (before, firstEtag) = await rig.PublicHomeAsync();
        before.Dispose();
        etags.Add(firstEtag);
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: true));
        await StepAsync(() => rig.MakeCoverAsync(orderId, 1));
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: false));
        await StepAsync(() => rig.SavePublicAsync(orderId, consent: true, show: true));
        await StepAsync(async () =>
        {
            using var response = await rig.HideLineAsync(PublicGalleryRig.LineId("basketball"));
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        });

        etags.Count.ShouldBe(6);
        etags.Zip(etags.Skip(1)).ShouldAllBe(pair => pair.First != pair.Second, "showing, a cover change, taking off, showing again and hiding the line must each move the Home ETag");
    }

    [Fact]
    public async Task EveryWriteToAShownOrderClearsThePublicCache()
    {
        var clears = await RunOrderWritesAsync(shown: true);

        clears.Select(step => step.Write).ShouldBe(OrderWriteNames);
        clears.Where(step => step.Clears == 0).Select(step => step.Write).ShouldBe(
            ["restore"],
            "every write to a shown order clears the public cache except a restore: the delete already took the order off the website (D-P11-BL-29), so a restore is not a public change");
    }

    [Fact]
    public async Task RestoringAnOrderDeletedWhileStillShownClearsThePublicCache()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var orderId = await rig.ShowOrderAsync("Legacy Restore Team", [10], (800, 600));
        await MarkDeletedInPlaceAsync(rig, orderId);
        var counter = new CountingPublicCache();
        await using var factory = rig.Factory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<Csps.Application.Ports.IPublicContentCache>();
            services.AddSingleton<Csps.Application.Ports.IPublicContentCache>(counter);
        }));
        using var client = factory.CreateClient();

        using var restored = await OrderFixtures.RestoreAsync(client, rig.Manager.AccessToken, orderId);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        counter.Count.ShouldBeGreaterThan(0, "the restore removes the left-over gallery entry, which is a public change");
    }

    [Fact]
    public async Task RestoringAnOrderDeletedWhileStillShownLeavesNoStaleItemInTheCachedPublicGallery()
    {
        await using var rig = await PublicGalleryRig.StartAsync(database);
        var orderId = await rig.ShowOrderAsync("Legacy Restore Team", [10], (800, 600));
        (await TeamsAsync(rig)).ShouldBe(["Legacy Restore Team"]);
        await MarkDeletedInPlaceAsync(rig, orderId);
        using var client = rig.Factory.CreateClient();

        using var restored = await OrderFixtures.RestoreAsync(client, rig.Manager.AccessToken, orderId);

        restored.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await TeamsAsync(rig)).ShouldBeEmpty("the restore took the order off the website, so the next public read must not list it");
    }

    // The state a delete saved before D-P11-BL-29 left behind: the order is deleted but still shown, and no interceptor ran.
    private static async Task MarkDeletedInPlaceAsync(PublicGalleryRig rig, Guid orderId)
    {
        await using var context = rig.Database.CreateContext();
        var deletedAt = TimeProvider.System.GetUtcNow();
        var deletedBy = rig.Manager.UserId;
        var changed = await context.Orders
            .Where(order => order.Id == orderId)
            .ExecuteUpdateAsync(set => set.SetProperty(order => order.DeletedAtUtc, deletedAt).SetProperty(order => order.DeletedById, deletedBy), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }

    private static async Task<List<string>> TeamsAsync(PublicGalleryRig rig)
    {
        var (document, _) = await rig.GalleryAsync();
        using (document)
        {
            return [.. document.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("team").GetString()!)];
        }
    }

    [Fact]
    public async Task TheSameWritesToAnOrderThatWasNeverShownDoNotClearThePublicCache()
    {
        var clears = await RunOrderWritesAsync(shown: false);

        clears.Select(step => step.Write).ShouldBe(OrderWriteNames);
        clears.Where(step => step.Clears != 0).Select(step => step.Write).ShouldBeEmpty("an order that was never shown is not public data");
    }

    private async Task<List<(string Write, int Clears)>> RunOrderWritesAsync(bool shown)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        var basketball = Csps.Domain.Content.ProductLineSeed.All.Single(entry => entry.Key == "basketball").Id;
        await using (var setup = database.CreateContext())
        {
            (await setup.ProductTypes.SingleAsync(row => row.Id == OrderFixtures.BasketballId, TestContext.Current.CancellationToken)).LinkToLine(basketball);
            await setup.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var counter = new CountingPublicCache();
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<Csps.Application.Ports.IPublicContentCache>();
            services.AddSingleton<Csps.Application.Ports.IPublicContentCache>(counter);
        }));
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var token = manager.AccessToken;
        var today = await TodayAsync(factory);
        var steps = new List<(string Write, int Clears)>();

        async Task<JsonElement> NewOrderAsync()
        {
            var created = await OrderFixtures.CreateAsync(client, token, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
            return shown ? await SavePublicAsync(client, token, created, consent: true, show: true, name: null) : created;
        }

        async Task StepAsync(string write, Func<Task> action)
        {
            var before = counter.Count;
            await action();
            steps.Add((write, counter.Count - before));
        }

        var order = await NewOrderAsync();
        if (shown)
        {
            counter.Count.ShouldBeGreaterThan(0, "showing the order adds its gallery entry, so the counter must have seen a clear");
        }

        var orderId = order.GetProperty("id").GetGuid();
        var number = order.GetProperty("number").GetString()!;
        Task<JsonElement> LatestAsync() => OrderFixtures.ReadDetailAsync(client, token, orderId);

        await StepAsync("public settings save", async () => _ = await SavePublicAsync(client, token, await LatestAsync(), consent: true, show: shown, name: shown ? "Display Name" : null));
        await StepAsync("item add", async () => _ = await OrderFixtures.AddItemAndReadAsync(client, token, await LatestAsync(), OrderFixtures.BasketballId, "Sample shorts"));
        var itemId = (await LatestAsync()).GetProperty("items").EnumerateArray().Single(item => item.GetProperty("description").GetString() == "Sample shorts").GetProperty("id").GetGuid();
        await StepAsync("item quantity edit", async () =>
        {
            using var response = await OrderFixtures.PutItemAsync(client, token, orderId, itemId, OrderFixtures.ItemBody(OrderFixtures.BasketballId, (await LatestAsync()).GetProperty("version").GetString(), "Sample shorts", "L", 3, 300.00m));
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        });
        await StepAsync("item delete", async () =>
        {
            using var response = await OrderFixtures.DeleteItemAsync(client, token, orderId, itemId);
            response.IsSuccessStatusCode.ShouldBeTrue(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        });
        await StepAsync("team name change", async () =>
        {
            var body = OrderFixtures.DetailsBodyFrom(await LatestAsync());
            body["teamName"] = "Tondo Riders MC";
            using var response = await OrderFixtures.PutDetailsAsync(client, token, orderId, body);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        });
        await StepAsync("photo add", () => UploadPhotoAsync(client, token, orderId, 640, 480));
        await StepAsync("second photo add", () => UploadPhotoAsync(client, token, orderId, 800, 600));
        var photos = (await LatestAsync()).GetProperty("images").EnumerateArray().Select(image => image.GetProperty("id").GetGuid()).ToList();
        await StepAsync("cover change", async () =>
        {
            using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{orderId:D}/images/{photos[1]:D}/position", token);
            request.Content = JsonContent.Create(new Dictionary<string, object?> { ["position"] = 0, ["version"] = (await LatestAsync()).GetProperty("version").GetString() });
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        });
        await StepAsync("photo remove", async () =>
        {
            using var request = ApiRequests.Create(HttpMethod.Delete, $"/api/v1/orders/{orderId:D}/images/{photos[0]:D}", token);
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            response.IsSuccessStatusCode.ShouldBeTrue(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        });
        await StepAsync("delete", async () =>
        {
            using var response = await OrderFixtures.DeleteAsync(client, token, orderId);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        });
        await StepAsync("restore", async () =>
        {
            using var response = await OrderFixtures.RestoreAsync(client, token, orderId);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        });
        if (shown)
        {
            _ = await SavePublicAsync(client, token, await LatestAsync(), consent: true, show: true, name: "Display Name");
        }

        await StepAsync("permanent delete", async () =>
        {
            using var response = await OrderFixtures.PermanentlyDeleteAsync(client, token, orderId, number);
            response.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        });

        var second = await NewOrderAsync();
        await StepAsync("cancel", async () => _ = await OrderFixtures.ChangeStatusAndReadAsync(client, token, second.GetProperty("id").GetGuid(), "cancelled"));
        return steps;
    }

    private static async Task<DateOnly> TodayAsync(WebApplicationFactory<Program> factory)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var calendar = scope.ServiceProvider.GetRequiredService<Csps.Application.Ports.IBusinessCalendar>();
            return (await calendar.GetClockAsync(TestContext.Current.CancellationToken)).Today;
        }
    }

    private static async Task<JsonElement> SavePublicAsync(HttpClient client, string token, JsonElement order, bool consent, bool show, string? name)
    {
        using var request = ApiRequests.Create(HttpMethod.Put, $"/api/v1/orders/{order.GetProperty("id").GetGuid():D}/public", token);
        request.Content = JsonContent.Create(new Dictionary<string, object?>
        {
            ["version"] = order.GetProperty("version").GetString(),
            ["customerConsent"] = consent,
            ["showOnWebsite"] = show,
            ["productLineId"] = null,
            ["publicName"] = name,
        });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    private static async Task UploadPhotoAsync(HttpClient client, string token, Guid orderId, int width, int height)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", token);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("cache-boundary", [MultipartPart.Upload("file", SyntheticImages.Jpeg(width, height))]);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    // Counts the clears the interceptor asks for; it never touches the real cache.
    private sealed class CountingPublicCache : Csps.Application.Ports.IPublicContentCache
    {
        private int _count;

        public int Count => Volatile.Read(ref _count);

        public ValueTask InvalidateAsync(CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _count);
            return ValueTask.CompletedTask;
        }
    }

    private static async Task ChangeTestimonialAsync(IDbContextFactory<CspsDbContext> contexts, Guid id, Action<Csps.Domain.Content.Testimonial> change)
    {
        await using var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken);
        change(await context.Testimonials.SingleAsync(row => row.Id == id, TestContext.Current.CancellationToken));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<string> ETagAsync(HttpClient client, string route)
    {
        using var response = await client.GetAsync(new Uri(route, UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return response.Headers.ETag.ShouldNotBeNull().ToString();
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
