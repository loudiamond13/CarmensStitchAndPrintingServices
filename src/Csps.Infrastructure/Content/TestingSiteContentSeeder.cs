#if CSPS_TESTING
using Csps.Domain.Content;
using Csps.Domain.Time;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Puts the demo business info, the two demo phone numbers, the demo week (Monday to Saturday 09:00 to 18:00, Sunday closed) and one demo
/// closure (20 days after the business today, note "Demo holiday") in place for E2E specs (QUAL-05). It puts the six product lines back to
/// their seeded text (shown, no price), gives basketball the demo price 650.00 with a minimum of 10, and deletes the lines whose short
/// name starts with "E2E-" with their photos and links. It puts the four demo testimonials in place (three shown in order and one
/// hidden, made-up names) and deletes the testimonials whose name starts with "E2E-". Every value is clearly fake. It saves through the
/// context's interceptors, so the public cache is cleared like after any real change. Debug builds only. Later plans extend it for their
/// own tables, deleting rows whose name starts with "E2E-". Demo testimonials exist only here: the migration and the production seed
/// never create one.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
public sealed class TestingSiteContentSeeder(CspsDbContext context, TimeProvider time)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

    private const int DemoClosureDaysAhead = 20;

    private const string DemoClosureNote = "Demo holiday";

    private const string E2EPrefix = "E2E-";

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
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    /// <summary>Sets the demo settings, replaces the phone list with the two demo numbers and sets the demo week.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes when the demo content is saved.</returns>
    public async Task ResetAsync(CancellationToken cancellationToken)
    {
        // One reset at a time: the matrix test calls this route from several callers at once.
        await Gate.WaitAsync(cancellationToken).ConfigureAwait(false);
        try
        {
            var settings = await context.SiteSettings.SingleAsync(cancellationToken).ConfigureAwait(false);
            var changes = settings.UpdateBusinessInfo(Demo, time.GetUtcNow()).Value;

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
        }
        finally
        {
            Gate.Release();
        }
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
