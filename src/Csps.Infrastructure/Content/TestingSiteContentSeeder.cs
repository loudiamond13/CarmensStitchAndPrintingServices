#if CSPS_TESTING
using Csps.Application.Images;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using Csps.Infrastructure.Images;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Puts the demo business info, the two demo phone numbers, the demo week (Monday to Saturday 09:00 to 18:00, Sunday closed) and one demo
/// closure (20 days after the business today, note "Demo holiday") in place for E2E specs (QUAL-05). It puts the six product lines back to
/// their seeded text (shown, no price), gives basketball the demo price 650.00 with a minimum of 10, and deletes the lines whose short
/// name starts with "E2E-" with their photos and links. It puts the four demo testimonials in place (three shown in order and one
/// hidden, made-up names) and deletes the testimonials whose name starts with "E2E-". It puts the five demo gallery orders in place: four
/// shown (made-up teams on the basketball, volleyball and moto lines, one with four photos) and one with the customer's OK that is not
/// shown. It takes every other shown order off the website. It puts two demo gallery uploads below them (shown, one with pieces and a note and one with neither) and deletes the uploads
/// whose team starts with "E2E-". It leaves a demo default link preview picture in place (1200 x 630), so a spec can check the page heads.
/// Every demo photo and the demo share picture have a tiny valid file in the in-memory photo store, so their addresses answer 200. The demo orders' customer values all contain <see cref="PrivateMarker"/>, so a spec can search a page for it. Every value is clearly fake. It saves through the
/// context's interceptors, so the public cache is cleared like after any real change. Debug builds only. Later plans extend it for their
/// own tables, deleting rows whose name starts with "E2E-". Demo testimonials exist only here: the migration and the production seed
/// never create one.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
/// <param name="storage">The image storage; demo photo files are stored only when it is the in-memory store of the Testing environment.</param>
public sealed class TestingSiteContentSeeder(CspsDbContext context, TimeProvider time, IImageStorage storage)
{
    // A 1 x 1 PNG, the same file for every demo photo.
    private static readonly byte[] DemoPhotoBytes = Convert.FromBase64String("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==");

    private static readonly SemaphoreSlim Gate = new(1, 1);

    private const int DemoClosureDaysAhead = 20;

    private const string DemoClosureNote = "Demo holiday";

    private const string E2EPrefix = "E2E-";

    /// <summary>The text every demo customer value contains, so a spec can prove none of them reaches a public page.</summary>
    public const string PrivateMarker = "PRIVATE-DEMO";

    private const string DemoOrderPrefix = "DEMO-GALLERY-";

    private const int DemoShareWidth = 1200;

    private const int DemoShareHeight = 630;

    private static readonly DemoOrder[] DemoOrders =
    [
        new("Brgy. Sample Ballers", "basketball", 17, [(1600, 1200), (1200, 1600), (1500, 1500), (1600, 900)], Shown: true),
        new("Sample City Spikers", "volleyball", 12, [(1200, 1600)], Shown: true),
        new("Sample Riders MC", "moto", 8, [(1600, 900), (1200, 1200)], Shown: true),
        new("Tondo Sample Hoopers", "basketball", 24, [(1600, 1200)], Shown: true),
        new("Hidden Sample Team", "basketball", 6, [(1200, 1200)], Shown: false),
    ];

    private const string DemoPricedLineKey = "basketball";

    private const decimal DemoLinePrice = 650.00m;

    private const int DemoLineMinimum = 10;

    private static readonly TestimonialValues[] DemoTestimonials =
    [
        new("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", "Captain, Brgy. Sample Ballers", 5, true),
        new("The mockup came back in a day and the colors matched our crest.", "Ana Reyes", "Coach, Sample City Spikers", 5, true),
        new("Light jerseys, and the sponsor logos printed sharp.", "Ben Santos", "President, Sample Riders MC", 4, true),
        new("A hidden demo testimonial for tests.", "Carlo Mendoza", null, 3, false),
    ];

    private sealed record DemoOrder(string Team, string LineKey, int Pieces, (int Width, int Height)[] Photos, bool Shown);

    private static readonly DemoUpload[] DemoUploads =
    [
        new("Sample Old Hoopers", "basketball", 14, "Dri-fit mesh, V-neck", (1200, 1600)),
        new("Sample Barangay Riders", "moto", null, null, (1600, 1200)),
    ];

    private sealed record DemoUpload(string Team, string LineKey, int? Pieces, string? Note, (int Width, int Height) Photo);

    private static readonly TimeOnly DemoOpens = new(9, 0);

    private static readonly TimeOnly DemoCloses = new(18, 0);

    private static readonly BusinessInfo Demo = new(
        SiteSettingsDefaults.BusinessName,
        SiteSettingsDefaults.Tagline,
        "A demo shop for end-to-end tests.",
        "Mockups in 24 hours; production starts as soon as the downpayment is in.",
        "12 Sample St., Poblacion",
        "Sample City",
        "Sample Province",
        "1000",
        "https://maps.app.goo.gl/cspsdemo",
        "https://www.google.com/maps/embed?pb=cspsdemo",
        "https://m.me/cspsdemo",
        "https://www.facebook.com/cspsdemo",
        "https://www.instagram.com/cspsdemo",
        "https://www.tiktok.com/@cspsdemo",
        "demo-shop@csps.test",
        null,
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    /// <summary>Gets a value indicating whether the reset may run on the connected database (<see cref="TestingDatabaseGuard"/>).</summary>
    public bool IsDatabaseAllowed => TestingDatabaseGuard.Allows(context);

    /// <summary>Sets the demo settings, replaces the phone list with the two demo numbers and sets the demo week. It throws on any database the guard refuses.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the demo content is saved.</returns>
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        if (!TestingDatabaseGuard.Allows(context))
        {
            throw new InvalidOperationException(TestingDatabaseGuard.Refusal);
        }

        // One reset at a time: the matrix test calls this route from several callers at once.
        await Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var settings = await context.SiteSettings.SingleAsync(cancellationToken).ConfigureAwait(false);
            var changes = settings.UpdateBusinessInfo(Demo, time.GetUtcNow()).Value;
            settings.SetSharePicture(new LinePhotoFile(NewDemoPhotoId($"csps-test/demo/{Guid.NewGuid():N}"), DemoShareWidth, DemoShareHeight, 120_000, "jpg"));

            // The old rows go first, so the unique number and main indexes never see two rows at once.
            context.SitePhoneNumbers.RemoveRange(await context.SitePhoneNumbers.ToListAsync(cancellationToken).ConfigureAwait(false));
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            context.SitePhoneNumbers.AddRange(changes.Phones);
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            foreach (var day in await context.OpeningHours.ToListAsync(cancellationToken).ConfigureAwait(false))
            {
                // The demo hours are always valid, so the result carries no error to handle.
                _ = day.SetHours(day.DayOfWeek <= 6 ? DemoOpens : null, day.DayOfWeek <= 6 ? DemoCloses : null);
            }

            // Exactly one demo closure, 20 days after the business today, so the Contact page has one to list.
            var (zone, source) = TimeZoneResolver.Resolve(settings.TimeZoneId);
            var today = new BusinessClock(zone, source, time.GetUtcNow()).Today;
            context.ShopClosures.RemoveRange(await context.ShopClosures.ToListAsync(cancellationToken).ConfigureAwait(false));
            context.ShopClosures.Add(ShopClosure.Create(today.AddDays(DemoClosureDaysAhead), null, DemoClosureNote, today, time.GetUtcNow()).Value);

            await ResetProductLinesAsync(cancellationToken).ConfigureAwait(false);
            await ResetTestimonialsAsync(cancellationToken).ConfigureAwait(false);
            await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

            await ResetDemoOrdersAsync(cancellationToken).ConfigureAwait(false);
            await ResetDemoUploadsAsync(cancellationToken).ConfigureAwait(false);
        }
        finally
        {
            Gate.Release();
        }
    }

    // The five demo orders are made new, so a run always ends with the same facts. The old ones go first (their photos, items and gallery
    // entries go with them through the foreign keys), and so does a demo order a test changed. The product types of the three demo lines are
    // filed under their lines, which the orders need for their auto line. The first shown order is at the top of the gallery and is the
    // newest shown, and the customer's OK is recorded by the legacy holder user.
    private async Task ResetDemoOrdersAsync(CancellationToken cancellationToken)
    {
        var stale = await context.Orders
            .IgnoreQueryFilters(["SoftDelete"])
            .Where(order => order.Number.StartsWith(DemoOrderPrefix))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        context.Orders.RemoveRange(stale);

        // Any other order on the website (the dev seed shows three, an earlier spec may have shown more) is taken off and loses its
        // gallery entry, so the gallery and Home hold only the demo set.
        var shown = await context.Orders
            .Where(order => !order.Number.StartsWith(DemoOrderPrefix) && order.ShownOnWebsiteSinceUtc != null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var shownIds = shown.Select(order => order.Id).ToList();
        context.GalleryEntries.RemoveRange(await context.GalleryEntries.Where(entry => entry.OrderId != null && shownIds.Contains(entry.OrderId.Value)).ToListAsync(cancellationToken).ConfigureAwait(false));
        foreach (var order in shown)
        {
            context.Entry(order).Property(row => row.ShownOnWebsiteSinceUtc).CurrentValue = null;
        }

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var now = time.GetUtcNow();
        var types = await context.ProductTypes.ToListAsync(cancellationToken).ConfigureAwait(false);
        foreach (var key in DemoOrders.Select(demo => demo.LineKey).Distinct())
        {
            DemoTypeOf(types, key).LinkToLine(ProductLineSeed.All.Single(entry => entry.Key == key).Id);
        }

        for (var index = 0; index < DemoOrders.Length; index++)
        {
            var demo = DemoOrders[index];
            var lineId = ProductLineSeed.All.Single(entry => entry.Key == demo.LineKey).Id;
            var details = new OrderDetails(
                $"{PrivateMarker}-NAME-{index + 1}",
                demo.Team,
                "0917 999 0002",
                "private-demo@csps.test",
                $"{PrivateMarker}-ADDRESS",
                new DateOnly(2026, 10, 1),
                null,
                $"{PrivateMarker}-NOTES");
            var item = new NewOrderItem(DemoTypeOf(types, demo.LineKey).Id, $"{PrivateMarker}-ITEM", null, demo.Pieces, 650.00m);
            var order = Order.Import(new OrderImportSnapshot($"{DemoOrderPrefix}{index + 1}", details, OrderStatus.Pending, [item]), OrderImportRules.Default, now).Value;
            foreach (var (width, height) in demo.Photos)
            {
                var photo = order.AddImage(new NewOrderImage(NewDemoPhotoId($"csps-test/demo/{Guid.NewGuid():N}"), width, height, 120_000, "jpg", $"{PrivateMarker}-PHOTO"), now);
                if (photo.IsFailure)
                {
                    throw new InvalidOperationException("The demo photo was refused.");
                }
            }

            var shownAt = now.AddMinutes(-index);
            var saved = order.SetPublicSettings(new OrderPublicSettings(CustomerConsent: true, ShowOnWebsite: demo.Shown, ProductLineId: null, PublicName: null), LegacyHolder.Id, lineId, shownAt);
            if (saved.IsFailure)
            {
                throw new InvalidOperationException("The demo public settings were refused.");
            }

            context.Orders.Add(order);
            if (demo.Shown)
            {
                context.GalleryEntries.Add(GalleryEntry.ForOrder(order.Id, index + 1, shownAt));
            }
        }

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    // The two demo uploads are made new below the demo orders, shown, one with pieces and a note and one with neither. An upload a test
    // added with an "E2E-" team goes too.
    private async Task ResetDemoUploadsAsync(CancellationToken cancellationToken)
    {
        var demoTeams = DemoUploads.Select(demo => demo.Team).ToList();
        var stale = await context.GalleryEntries
            .Where(entry => entry.Kind == GalleryEntryKind.Upload && entry.TeamName != null && (entry.TeamName.StartsWith(E2EPrefix) || demoTeams.Contains(entry.TeamName)))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        context.GalleryEntries.RemoveRange(stale);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var now = time.GetUtcNow();
        for (var index = 0; index < DemoUploads.Length; index++)
        {
            var demo = DemoUploads[index];
            var id = GalleryEntry.NewId(now);
            var file = new LinePhotoFile(NewDemoPhotoId($"csps-test/demo/{id:D}/{Guid.NewGuid():N}"), demo.Photo.Width, demo.Photo.Height, 120_000, "jpg");
            var values = new GalleryUploadValues(demo.Team, ProductLineSeed.All.Single(entry => entry.Key == demo.LineKey).Id, demo.Pieces, demo.Note, IsShown: true);
            var created = GalleryEntry.CreateUpload(id, values, file, DemoOrders.Length + 1 + index, now);
            if (created.IsFailure)
            {
                throw new InvalidOperationException("The demo upload was refused.");
            }

            context.GalleryEntries.Add(created.Value);
        }

        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    // Stores the tiny demo file under a public id and gives the id back.
    private string NewDemoPhotoId(string publicId)
    {
        if (storage is TestingImageStorage photos)
        {
            photos.Seed(publicId, DemoPhotoBytes, ImageKind.Png, time.GetUtcNow());
        }

        return publicId;
    }

    // The Basketball, Volleyball and Moto Riding Jersey product types are the first three of the seeded list, like the first three lines.
    private static ProductType DemoTypeOf(List<ProductType> types, string lineKey)
    {
        var seeded = OrderListSeed.ProductTypes[lineKey switch
        {
            "basketball" => 0,
            "volleyball" => 1,
            "moto" => 2,
            _ => throw new ArgumentOutOfRangeException(nameof(lineKey), lineKey, "No demo product type for this line."),
        }];
        return types.Single(type => type.Id == seeded.Id);
    }

    // The four demo testimonials are made new at places 1 to 4, so a run always ends with the same facts. A testimonial a test added
    // under the "E2E-" prefix goes, and so does a demo one a test changed or moved.
    private async Task ResetTestimonialsAsync(CancellationToken cancellationToken)
    {
        var demoNames = DemoTestimonials.Select(demo => demo.Name).ToList();
        var stale = await context.Testimonials
            .Where(testimonial => testimonial.Name.StartsWith(E2EPrefix) || demoNames.Contains(testimonial.Name))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        context.Testimonials.RemoveRange(stale);

        var now = time.GetUtcNow();
        for (var index = 0; index < DemoTestimonials.Length; index++)
        {
            context.Testimonials.Add(Testimonial.Create(DemoTestimonials[index], index + 1, now).Value);
        }
    }

    // The six seeded lines go back to the approved text, shown, with no price; basketball gets the demo price. A seeded line that was deleted is put back.
    private async Task ResetProductLinesAsync(CancellationToken cancellationToken)
    {
        var lines = await context.ProductLines.ToListAsync(cancellationToken).ConfigureAwait(false);
        var e2eIds = lines.Where(line => line.ShortName.StartsWith(E2EPrefix, StringComparison.Ordinal)).Select(line => line.Id).ToList();
        if (e2eIds.Count > 0)
        {
            context.ProductLinePhotos.RemoveRange(await context.ProductLinePhotos.Where(photo => e2eIds.Contains(photo.LineId)).ToListAsync(cancellationToken).ConfigureAwait(false));
            foreach (var type in await context.ProductTypes.Where(type => e2eIds.Contains(type.ProductLineId!.Value)).ToListAsync(cancellationToken).ConfigureAwait(false))
            {
                context.Entry(type).Property(row => row.ProductLineId).CurrentValue = null;
            }

            context.ProductLines.RemoveRange(lines.Where(line => e2eIds.Contains(line.Id)));
        }

        foreach (var entry in ProductLineSeed.All)
        {
            var priced = entry.Key == DemoPricedLineKey;
            var price = priced ? DemoLinePrice : (decimal?)null;
            var minimum = priced ? DemoLineMinimum : (int?)null;
            if (lines.SingleOrDefault(line => line.Id == entry.Id) is { } existing)
            {
                existing.ResetToSeed(entry, price, minimum);
            }
            else
            {
                context.ProductLines.Add(ProductLine.FromSeed(entry, price, minimum, time.GetUtcNow()));
            }
        }
    }
}
#endif
