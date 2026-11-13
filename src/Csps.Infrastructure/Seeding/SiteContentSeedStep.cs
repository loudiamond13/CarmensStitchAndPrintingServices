using Csps.Domain.Content;
using Csps.Domain.Identity;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Gives a development database a full demo public site (FND-04, Phase 11): demo business info with two phone numbers, a week of hours
/// (Monday to Saturday 09:00 to 18:00, Sunday closed), one closure 20 days ahead, prices on the basketball and volleyball lines, three shown
/// testimonials, and three demo orders shown on the website with the customer's OK. It goes through the domain methods only, and each part
/// is skipped when its table already holds what a Manager entered, so a second run changes nothing. The Facebook link and the shop email
/// stay empty, because the SiteSettings step puts those two seed defaults back on every run. All values are made up and safe for a public
/// repo. Like every dev-seed step it runs only through the guarded <c>tools/Csps.DevSeed</c> command.
/// </summary>
public sealed class SiteContentSeedStep : ISeedStep
{
    private const int DemoClosureDaysAhead = 20;

    private static readonly TimeOnly Opens = new(9, 0);

    private static readonly TimeOnly Closes = new(18, 0);

    private static readonly BusinessInfo Demo = new(
        SiteSettingsDefaults.BusinessName,
        SiteSettingsDefaults.Tagline,
        "A demo shop for local development.",
        "Mockups in 24 hours; production starts as soon as the downpayment is in.",
        "12 Sample St., Poblacion",
        "Sample City",
        "Sample Province",
        "1000",
        "https://maps.app.goo.gl/cspsdemo",
        "https://www.google.com/maps/embed?pb=cspsdemo",
        "https://m.me/cspsdemo",
        null,
        "https://www.instagram.com/cspsdemo",
        "https://www.tiktok.com/@cspsdemo",
        null,
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    private static readonly (string Key, decimal Price, decimal Minimum)[] DemoPrices =
    [
        ("basketball", 650.00m, 10),
        ("volleyball", 720.00m, 10),
    ];

    private static readonly TestimonialValues[] DemoTestimonials =
    [
        new("Seventeen pieces, names and numbers perfect.", "Juan Dela Cruz", "Captain, Brgy. Sample Ballers", 5, true),
        new("The mockup came back in a day and the colors matched our crest.", "Ana Reyes", "Coach, Sample City Spikers", 5, true),
        new("Light jerseys, and the sponsor logos printed sharp.", "Ben Santos", "President, Sample Riders MC", 4, true),
    ];

    // Demo orders of the Orders step, shown under their line. None is Cancelled, which cannot be shown.
    private static readonly (string Number, string LineKey)[] ShownOrders =
    [
        ("ORD-2026-0142", "moto"),
        ("ORD-2026-0148", "basketball"),
        ("ORD-2026-0157", "basketball"),
    ];

    /// <inheritdoc />
    public int Order => 500;

    /// <inheritdoc />
    public string Name => "SiteContent";

    /// <inheritdoc />
    public async Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(time);

        var now = time.GetUtcNow();
        var changed = await SeedBusinessInfoAsync(db, now, cancellationToken).ConfigureAwait(false);
        changed |= await SeedHoursAsync(db, cancellationToken).ConfigureAwait(false);
        changed |= await SeedClosureAsync(db, now, cancellationToken).ConfigureAwait(false);
        changed |= await SeedPricesAsync(db, cancellationToken).ConfigureAwait(false);
        changed |= await SeedTestimonialsAsync(db, now, cancellationToken).ConfigureAwait(false);
        changed |= await SeedShownOrdersAsync(db, now, cancellationToken).ConfigureAwait(false);
        return changed;
    }

    // An empty phone list means Business Info was never filled in.
    private static async Task<bool> SeedBusinessInfoAsync(CspsDbContext db, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (await db.SitePhoneNumbers.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        var settings = await db.SiteSettings.SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        if (settings is null)
        {
            return false;
        }

        var saved = settings.UpdateBusinessInfo(Demo, now);
        if (saved.IsFailure)
        {
            throw new InvalidOperationException($"The demo business info broke a rule: {saved.Error.Message}");
        }

        db.SitePhoneNumbers.AddRange(saved.Value.Phones);
        settings.MarkPhonesChanged(now);
        return true;
    }

    // A week with any open day was set by a Manager.
    private static async Task<bool> SeedHoursAsync(CspsDbContext db, CancellationToken cancellationToken)
    {
        var week = await db.OpeningHours.ToListAsync(cancellationToken).ConfigureAwait(false);
        if (week.Count == 0 || week.Any(day => day.OpensAt is not null))
        {
            return false;
        }

        foreach (var day in week)
        {
            var open = day.DayOfWeek < OpeningHours.LastDay;
            var saved = day.SetHours(open ? Opens : null, open ? Closes : null);
            if (saved.IsFailure)
            {
                throw new InvalidOperationException($"The demo hours broke a rule: {saved.Error.Message}");
            }
        }

        return true;
    }

    private static async Task<bool> SeedClosureAsync(CspsDbContext db, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (await db.ShopClosures.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        var zoneId = await db.SiteSettings.AsNoTracking().Select(settings => settings.TimeZoneId).SingleOrDefaultAsync(cancellationToken).ConfigureAwait(false);
        var (zone, source) = TimeZoneResolver.Resolve(zoneId);
        var today = new BusinessClock(zone, source, now).Today;
        var closure = ShopClosure.Create(today.AddDays(DemoClosureDaysAhead), null, "Demo holiday", today, now);
        if (closure.IsFailure)
        {
            throw new InvalidOperationException($"The demo closure broke a rule: {closure.Error.Message}");
        }

        db.ShopClosures.Add(closure.Value);
        return true;
    }

    // A line that already has a price keeps it; the other lines stay "Message us for a price" (D-40).
    private static async Task<bool> SeedPricesAsync(CspsDbContext db, CancellationToken cancellationToken)
    {
        var lines = await db.ProductLines.ToListAsync(cancellationToken).ConfigureAwait(false);
        var changed = false;
        foreach (var (key, price, minimum) in DemoPrices)
        {
            var line = lines.SingleOrDefault(row => row.Key == key);
            if (line is null || line.StartsAtPrice is not null)
            {
                continue;
            }

            var saved = line.Update(new ProductLineValues(
                line.Title, line.ShortName, line.Number, line.CardText, line.Description, line.FabricText,
                line.CollarText, line.CutText, line.NamesText, line.LogosText, price, minimum, null));
            if (saved.IsFailure)
            {
                throw new InvalidOperationException($"The demo price of {key} broke a rule: {saved.Error.Message}");
            }

            changed = true;
        }

        return changed;
    }

    private static async Task<bool> SeedTestimonialsAsync(CspsDbContext db, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (await db.Testimonials.AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        for (var index = 0; index < DemoTestimonials.Length; index++)
        {
            var testimonial = Testimonial.Create(DemoTestimonials[index], index + 1, now);
            if (testimonial.IsFailure)
            {
                throw new InvalidOperationException($"The demo testimonial {index + 1} broke a rule: {testimonial.Error.Message}");
            }

            db.Testimonials.Add(testimonial.Value);
        }

        return true;
    }

    // The customer's OK is recorded by the Legacy holder. An order that is missing, or that cannot be shown now, is left alone.
    private static async Task<bool> SeedShownOrdersAsync(CspsDbContext db, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var lineIds = await db.ProductLines.AsNoTracking().Select(line => line.Id).ToListAsync(cancellationToken).ConfigureAwait(false);
        var top = (await db.GalleryEntries.MinAsync(entry => (int?)entry.Position, cancellationToken).ConfigureAwait(false) ?? 1) - 1;
        var changed = false;
        foreach (var (number, lineKey) in ShownOrders)
        {
            var lineId = ProductLineSeed.All.Single(entry => entry.Key == lineKey).Id;
            var order = await db.Orders.SingleOrDefaultAsync(row => row.Number == number, cancellationToken).ConfigureAwait(false);
            if (order is null || !lineIds.Contains(lineId))
            {
                continue;
            }

            var saved = order.SetPublicSettings(new OrderPublicSettings(CustomerConsent: true, ShowOnWebsite: true, ProductLineId: lineId, PublicName: null), LegacyHolder.Id, null, now);
            if (saved.IsFailure || !saved.Value.HasAny)
            {
                continue;
            }

            changed = true;
            if (saved.Value.ShownChange is true)
            {
                db.GalleryEntries.Add(GalleryEntry.ForOrder(order.Id, top--, now));
            }
        }

        return changed;
    }
}
