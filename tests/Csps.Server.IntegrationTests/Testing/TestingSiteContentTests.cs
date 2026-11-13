using System.Net;
using System.Text.Json;
using Csps.Domain.Content;
using Csps.Domain.Identity;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Content;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// QUAL-05, D-37: <c>POST /api/testing/site-content</c> puts the demo business info and the two demo phone numbers in place for E2E
/// specs, in the Testing environment of a Debug build only. Running it again leaves the same rows.
/// </summary>
public sealed class TestingSiteContentTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/site-content";

    [Fact]
    public async Task APostAnswers204AndTheDemoFactsAreOnThePublicRead()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/site", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var site = document.RootElement;
        site.GetProperty("address").GetProperty("street").GetString().ShouldBe("12 Sample St., Poblacion");
        site.GetProperty("address").GetProperty("townOrCity").GetString().ShouldBe("Sample City");
        site.GetProperty("messengerUrl").GetString().ShouldBe("https://m.me/cspsdemo");
        var phones = site.GetProperty("phones");
        phones.GetArrayLength().ShouldBe(2);
        phones[0].GetProperty("display").GetString().ShouldBe("0917 123 4567");
        phones[0].GetProperty("isMain").GetBoolean().ShouldBeTrue();
        phones[1].GetProperty("display").GetString().ShouldBe("02 8123 4567");
    }

    [Fact]
    public async Task APostLeavesADemoSharePictureInPlaceAndTheHomeHeadCarriesIt()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await SharePictureRig.ClearAsync(database);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        try
        {
            using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
            using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);

            first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
            await using var context = database.CreateContext();
            var row = await context.SiteSettings.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
            row.SharePicturePublicId.ShouldNotBeNull().ShouldStartWith("csps-test/demo/");
            (row.SharePictureWidth, row.SharePictureHeight, row.SharePictureFormat).ShouldBe((1200, 630, "jpg"));
            var home = await client.GetStringAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);
            home.ShouldContain("size=csps_share_1200");
            home.ShouldContain("content=\"summary_large_image\"");
        }
        finally
        {
            await SharePictureRig.ClearAsync(database);
        }
    }

    [Fact]
    public async Task APostPutsTheDemoWeekInPlaceMondayToSaturdayNineToSixAndSundayClosed()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await PublicContentSeeding.SaveHoursAsync(database, []);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var rows = await context.OpeningHours.AsNoTracking().OrderBy(row => row.DayOfWeek).ToListAsync(TestContext.Current.CancellationToken);
        rows.Take(6).ShouldAllBe(row => row.OpensAt == new TimeOnly(9, 0) && row.ClosesAt == new TimeOnly(18, 0));
        rows[6].OpensAt.ShouldBeNull();
        rows[6].ClosesAt.ShouldBeNull();
    }

    [Fact]
    public async Task APostKeepsExactlyOneDemoClosureTwentyDaysAheadEvenWhenRunTwiceAndReplacesOtherClosures()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        var before = PublicContentSeeding.ManilaToday();
        await PublicContentSeeding.SaveClosuresAsync(database, [(before.AddDays(3), before.AddDays(4), "Left over")]);
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);

        var after = PublicContentSeeding.ManilaToday();
        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        var closure = await context.ShopClosures.AsNoTracking().SingleAsync(TestContext.Current.CancellationToken);
        closure.Note.ShouldBe("Demo holiday");
        closure.FirstDay.ShouldBeOneOf(before.AddDays(20), after.AddDays(20));
        closure.LastDay.ShouldBe(closure.FirstDay);
        await PublicContentSeeding.SaveClosuresAsync(database, []);
    }

    [Fact]
    public async Task APostRestoresTheSixLinesToTheSeededTextWithOnlyBasketballPricedSixHundredFiftyWithAMinimumOfTen()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using (var context = database.CreateContext())
        {
            await context.ProductLines.Where(line => line.Key == "polo").ExecuteUpdateAsync(
                update => update.SetProperty(line => line.IsActive, false).SetProperty(line => line.Title, "Changed title"),
                TestContext.Current.CancellationToken);
            await context.ProductLines.Where(line => line.Key == "moto").ExecuteUpdateAsync(
                update => update.SetProperty(line => line.StartsAtPrice, 99.00m).SetProperty(line => line.Position, 9),
                TestContext.Current.CancellationToken);
        }

        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/product-lines", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var lines = document.RootElement.GetProperty("lines").EnumerateArray().ToList();
        lines.Select(line => line.GetProperty("key").GetString()).ShouldBe(["basketball", "volleyball", "moto", "longsleeves", "polo", "custom"]);
        lines.Select(line => line.GetProperty("title").GetString()).ShouldBe(ProductLineSeed.All.Select(entry => entry.Title));
        lines[0].GetProperty("startsAtPrice").GetDecimal().ShouldBe(650.00m);
        lines[0].GetProperty("minimumQuantity").GetInt32().ShouldBe(10);
        lines.Skip(1).ShouldAllBe(line => line.GetProperty("startsAtPrice").ValueKind == JsonValueKind.Null && line.GetProperty("minimumQuantity").ValueKind == JsonValueKind.Null);
    }

    [Fact]
    public async Task APostRemovesTheLinesWhoseShortNameStartsWithE2EAndTheirPhotosAndLinks()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        var now = new DateTimeOffset(2026, 11, 12, 3, 0, 0, TimeSpan.Zero);
        var spec = ProductLineSeed.All[0] with { Id = Guid.CreateVersion7(now), Key = "e2e-kit", ShortName = "E2E-Kit", Position = 20 };
        var photo = ProductLinePhoto.Create(spec.Id, ProductLinePhotoSlot.Main, "test/e2e-kit", 100, 100, 1000, "jpg", now);
        await using (var context = database.CreateContext())
        {
            context.ProductLines.Add(ProductLine.FromSeed(spec, null, null, now));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            context.ProductLinePhotos.Add(photo);
            var type = await context.ProductTypes.OrderBy(row => row.Id).FirstAsync(TestContext.Current.CancellationToken);
            context.Entry(type).Property(row => row.ProductLineId).CurrentValue = spec.Id;
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var check = database.CreateContext();
        (await check.ProductLines.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(6);
        (await check.ProductLinePhotos.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
        (await check.ProductTypes.CountAsync(row => row.ProductLineId == spec.Id, TestContext.Current.CancellationToken)).ShouldBe(0);

        // Only the three product types the demo gallery orders need stay filed under a line.
        (await check.ProductTypes.CountAsync(row => row.ProductLineId != null, TestContext.Current.CancellationToken)).ShouldBe(3);
    }

    [Fact]
    public async Task APostLeavesThreeShownDemoTestimonialsInOrderAndOneHiddenAndTheHomeReadShowsTheShownOnes()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/home", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using (var context = database.CreateContext())
        {
            var rows = await context.Testimonials.AsNoTracking().OrderBy(row => row.Position).ThenBy(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
            rows.Count.ShouldBe(4);
            rows.Select(row => row.IsShown).ShouldBe([true, true, true, false]);
            rows.Select(row => row.Position).ShouldBe([1, 2, 3, 4]);
            rows.ShouldAllBe(row => row.Stars >= 1 && row.Stars <= 5 && row.Quote.Length > 0 && row.Name.Length > 0);
        }

        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var shown = document.RootElement.GetProperty("testimonials").EnumerateArray().ToList();
        shown.Count.ShouldBe(3);
        shown[0].GetProperty("name").GetString().ShouldBe("Juan Dela Cruz");
        shown[0].GetProperty("teamOrRole").GetString().ShouldBe("Captain, Brgy. Sample Ballers");
    }

    [Fact]
    public async Task APostRemovesTheTestimonialsNamedWithTheE2EPrefixAndRunningItTwiceLeavesTheSameFour()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await database.ResetAsync();
        await using (var context = database.CreateContext())
        {
            context.Testimonials.Add(Testimonial.Create(new TestimonialValues("A quote typed by a test.", "E2E-Ana", null, 4, true), 1, new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero)).Value);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var once = await TestimonialFactsAsync();
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var twice = await TestimonialFactsAsync();

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        once.Count.ShouldBe(4);
        once.ShouldNotContain(fact => fact.StartsWith("E2E-", StringComparison.Ordinal));
        twice.ShouldBe(once);
    }

    [Fact]
    public async Task RunningItTwiceLeavesTheSameRows()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var once = await PhoneNumbersAsync();
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var twice = await PhoneNumbersAsync();

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        once.ShouldBe(["+639171234567", "+63281234567"]);
        twice.ShouldBe(once);
    }

    [Fact]
    public async Task APostLeavesTheFourDemoShownOrdersTheOneNotShownAndTheTwoDemoUploadsEvenWhenRunTwiceAndTheGalleryListsTheSix()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/gallery", UriKind.Relative), TestContext.Current.CancellationToken);

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using (var context = database.CreateContext())
        {
            var demo = await context.Orders.AsNoTracking().Where(order => order.Number.StartsWith("DEMO-GALLERY-")).ToListAsync(TestContext.Current.CancellationToken);
            demo.Count.ShouldBe(5);
            demo.Count(order => order.ShownOnWebsiteSinceUtc != null).ShouldBe(4);
            demo.Where(order => order.ShownOnWebsiteSinceUtc == null).ShouldHaveSingleItem().PublicConsentAtUtc.ShouldNotBeNull();
            (await context.GalleryEntries.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(6);
            var uploads = await context.GalleryEntries.AsNoTracking().Where(entry => entry.Kind == GalleryEntryKind.Upload).OrderBy(entry => entry.Position).ToListAsync(TestContext.Current.CancellationToken);
            uploads.Select(entry => entry.TeamName).ShouldBe(["Sample Old Hoopers", "Sample Barangay Riders"]);
            uploads.Select(entry => entry.Pieces).ShouldBe([14, null]);
            uploads.Select(entry => entry.Note).ShouldBe(["Dri-fit mesh, V-neck", null]);
            uploads.ShouldAllBe(entry => entry.IsShown);
        }

        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var items = document.RootElement.GetProperty("items").EnumerateArray().ToList();
        items.Select(item => item.GetProperty("team").GetString()).ShouldBe(["Brgy. Sample Ballers", "Sample City Spikers", "Sample Riders MC", "Tondo Sample Hoopers", "Sample Old Hoopers", "Sample Barangay Riders"]);
        items.Select(item => item.GetProperty("lineKey").GetString()).ShouldBe(["basketball", "volleyball", "moto", "basketball", "basketball", "moto"]);
        items.Select(item => item.GetProperty("photos").GetArrayLength()).ShouldBe([4, 1, 2, 1, 1, 1]);
        document.RootElement.GetProperty("pills").EnumerateArray().Select(pill => pill.GetProperty("count").GetInt32()).ShouldBe([3, 1, 2]);
    }

    [Fact]
    public async Task APostStoresATinyPhotoFileForEveryDemoPhotoAndTheSharePictureSoTheirAddressesAnswer200()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/gallery", UriKind.Relative), TestContext.Current.CancellationToken);
        var home = await client.GetStringAsync(new Uri("/", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var addresses = document.RootElement.GetProperty("items").EnumerateArray()
            .SelectMany(item => item.GetProperty("photos").EnumerateArray())
            .SelectMany(photo => new[] { photo.GetProperty("src").GetString(), photo.GetProperty("thumbSrc").GetString() })
            .ToList();
        addresses.Count.ShouldBe(20);
        const string ShareMarker = "<meta property=\"og:image\" content=\"";
        var shareStart = home.IndexOf(ShareMarker, StringComparison.Ordinal);
        shareStart.ShouldBeGreaterThanOrEqualTo(0);
        shareStart += ShareMarker.Length;
        addresses.Add(home[shareStart..home.IndexOf('"', shareStart)]);
        foreach (var address in addresses)
        {
            var uri = new Uri(address!, UriKind.RelativeOrAbsolute);
            using var photo = await client.GetAsync(new Uri(uri.IsAbsoluteUri ? uri.PathAndQuery : address!, UriKind.Relative), TestContext.Current.CancellationToken);
            photo.StatusCode.ShouldBe(HttpStatusCode.OK, address);
            photo.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("image/png");
            (await photo.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken)).Length.ShouldBeGreaterThan(0);
        }
    }

    [Fact]
    public async Task APostTakesAnyOtherShownOrderOffTheWebsiteSoTheGalleryHoldsOnlyTheDemoSet()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await GallerySeeding.AddOrdersAsync(database, [new SeedGalleryOrder("Leftover Shown Team")], LegacyHolder.Id, new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/gallery", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        await using var context = database.CreateContext();
        (await context.GalleryEntries.AsNoTracking().CountAsync(TestContext.Current.CancellationToken)).ShouldBe(6);
        (await context.Orders.AsNoTracking().CountAsync(order => order.ShownOnWebsiteSinceUtc != null, TestContext.Current.CancellationToken)).ShouldBe(4);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("items").EnumerateArray().Select(item => item.GetProperty("team").GetString()).ShouldNotContain("Leftover Shown Team");
    }

    [Fact]
    public async Task APostRemovesTheUploadsNamedWithTheE2EPrefixAndRunningItTwiceLeavesTheSameTwoDemoUploads()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.AddUploadAsync(database, new SeedGalleryUpload("E2E-Upload", "moto") { Position = 50 }, new DateTimeOffset(2026, 11, 12, 8, 0, 0, TimeSpan.Zero));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var once = await UploadFactsAsync();
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var twice = await UploadFactsAsync();

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        once.ShouldBe(["Sample Old Hoopers|14|Dri-fit mesh, V-neck|True", "Sample Barangay Riders|||True"]);
        twice.ShouldBe(once);
    }

    private async Task<List<string>> UploadFactsAsync()
    {
        await using var context = database.CreateContext();
        var rows = await context.GalleryEntries.AsNoTracking().Where(entry => entry.Kind == GalleryEntryKind.Upload).OrderBy(entry => entry.Position).ThenBy(entry => entry.Id).ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.Select(row => $"{row.TeamName}|{row.Pieces}|{row.Note}|{row.IsShown}")];
    }

    private async Task<List<string>> TestimonialFactsAsync()
    {
        await using var context = database.CreateContext();
        var rows = await context.Testimonials.AsNoTracking().OrderBy(row => row.Position).ThenBy(row => row.Id).ToListAsync(TestContext.Current.CancellationToken);
        return [.. rows.Select(row => $"{row.Name}|{row.Quote}|{row.TeamOrRole}|{row.Stars}|{row.IsShown}|{row.Position}")];
    }

    private async Task<List<string>> PhoneNumbersAsync()
    {
        await using var context = database.CreateContext();
        return await context.SitePhoneNumbers.AsNoTracking().OrderBy(phone => phone.Position).Select(phone => phone.Number).ToListAsync(TestContext.Current.CancellationToken);
    }
}
