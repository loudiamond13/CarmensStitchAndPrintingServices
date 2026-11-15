using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Testing;

/// <summary>Writes the public business info (settings and phone list) for tests, with clearly fake values.</summary>
public static class PublicContentSeeding
{
    /// <summary>The instant the helper stamps with when a test gives none.</summary>
    public static readonly DateTimeOffset DefaultNow = new(2026, 11, 11, 9, 0, 0, TimeSpan.Zero);

    /// <summary>Gets fake business info with a main mobile number and a landline.</summary>
    /// <param name="tagline">The tagline to use.</param>
    /// <returns>The values.</returns>
    public static BusinessInfo Demo(string tagline = "Sample tagline") => new(
        "Sample Shop",
        tagline,
        "About the sample shop.",
        "Mockups in 24 hours.",
        "12 Sample St., Poblacion",
        "Sample City",
        "Sample Province",
        "1000",
        "https://maps.app.goo.gl/abc123",
        "https://www.google.com/maps/embed?pb=sample",
        "https://m.me/cspsdemo",
        "https://www.facebook.com/cspsdemo",
        "https://www.instagram.com/cspsdemo",
        "https://www.tiktok.com/@cspsdemo",
        "shop-private@example.test",
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    /// <summary>Gets business info with only the required values: no address, links, about text or phone numbers.</summary>
    /// <returns>The values.</returns>
    public static BusinessInfo Bare() => new(
        "Sample Shop", "Sample tagline", null, null, null, null, null, null, null, null, null, null, null, null, null, []);

    /// <summary>Gets the demo week: Monday to Saturday 09:00 to 18:00 and Sunday closed.</summary>
    public static IReadOnlyList<(int Day, TimeOnly? Opens, TimeOnly? Closes)> DemoWeek { get; } =
        [.. Enumerable.Range(1, 7).Select(day => day <= 6 ? (day, (TimeOnly?)new TimeOnly(9, 0), (TimeOnly?)new TimeOnly(18, 0)) : (day, null, null))];

    /// <summary>Saves the info on the database with a plain context (no interceptors): settings first, then the phone list.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="info">The values to store.</param>
    /// <returns>A task that completes when the values are stored.</returns>
    public static async Task SaveAsync(CspsDatabase database, BusinessInfo info)
    {
        ArgumentNullException.ThrowIfNull(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            await SaveAsync(context, info, DefaultNow).ConfigureAwait(false);
        }
    }

    /// <summary>Saves the weekly hours with a plain context (no interceptors). A day that is not listed is closed.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="week">The days to set, 1 for Monday to 7 for Sunday.</param>
    /// <returns>A task that completes when the hours are stored.</returns>
    public static async Task SaveHoursAsync(CspsDatabase database, IReadOnlyList<(int Day, TimeOnly? Opens, TimeOnly? Closes)> week)
    {
        ArgumentNullException.ThrowIfNull(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            await SaveHoursAsync(context, week).ConfigureAwait(false);
        }
    }

    /// <summary>Saves the weekly hours through the given context, so its interceptors run. A day that is not listed is closed.</summary>
    /// <param name="context">The context to save through.</param>
    /// <param name="week">The days to set, 1 for Monday to 7 for Sunday.</param>
    /// <returns>A task that completes when the hours are stored.</returns>
    public static async Task SaveHoursAsync(CspsDbContext context, IReadOnlyList<(int Day, TimeOnly? Opens, TimeOnly? Closes)> week)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(week);
        foreach (var row in await context.OpeningHours.ToListAsync().ConfigureAwait(false))
        {
            var (_, opens, closes) = week.FirstOrDefault(entry => entry.Day == row.DayOfWeek);
            var result = row.SetHours(opens, closes);
            if (result.IsFailure)
            {
                throw new InvalidOperationException($"The test hours for day {row.DayOfWeek} are not valid: {result.Error.Message}");
            }
        }

        await context.SaveChangesAsync().ConfigureAwait(false);
    }

    /// <summary>Gets today's date in Asia/Manila (UTC+8, no daylight saving), the business day the public reads use.</summary>
    /// <returns>The business today.</returns>
    public static DateOnly ManilaToday() => DateOnly.FromDateTime(TimeProvider.System.GetUtcNow().AddHours(8).DateTime);

    /// <summary>
    /// Replaces every closure with the given ones, with a plain context (no interceptors). A closure may start in the past, for a
    /// closure that is already running.
    /// </summary>
    /// <param name="database">The test database.</param>
    /// <param name="closures">The closures to store; none removes them all.</param>
    /// <returns>A task that completes when the closures are stored.</returns>
    public static async Task SaveClosuresAsync(CspsDatabase database, IReadOnlyList<(DateOnly First, DateOnly? Last, string? Note)> closures)
    {
        ArgumentNullException.ThrowIfNull(database);
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            await SaveClosuresAsync(context, closures).ConfigureAwait(false);
        }
    }

    /// <summary>Replaces every closure with the given ones through the given context, so its interceptors run.</summary>
    /// <param name="context">The context to save through.</param>
    /// <param name="closures">The closures to store; none removes them all.</param>
    /// <returns>A task that completes when the closures are stored.</returns>
    public static async Task SaveClosuresAsync(CspsDbContext context, IReadOnlyList<(DateOnly First, DateOnly? Last, string? Note)> closures)
    {
        ArgumentNullException.ThrowIfNull(context);
        ArgumentNullException.ThrowIfNull(closures);
        context.ShopClosures.RemoveRange(await context.ShopClosures.ToListAsync().ConfigureAwait(false));
        foreach (var (first, last, note) in closures)
        {
            var created = ShopClosure.Create(first, last, note, first, DefaultNow);
            context.ShopClosures.Add(created.IsSuccess ? created.Value : throw new InvalidOperationException($"The test closure is not valid: {created.Error.Message}"));
        }

        await context.SaveChangesAsync().ConfigureAwait(false);
    }

    /// <summary>Saves the info through the given context, so its interceptors run: the old phone rows go first, then the new ones.</summary>
    /// <param name="context">The context to save through.</param>
    /// <param name="info">The values to store.</param>
    /// <param name="now">The instant to stamp new rows with.</param>
    /// <returns>A task that completes when the values are stored.</returns>
    public static async Task SaveAsync(CspsDbContext context, BusinessInfo info, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(context);
        var settings = await context.SiteSettings.SingleAsync().ConfigureAwait(false);
        var changes = settings.UpdateBusinessInfo(info, now).Value;
        context.SitePhoneNumbers.RemoveRange(await context.SitePhoneNumbers.ToListAsync().ConfigureAwait(false));
        await context.SaveChangesAsync().ConfigureAwait(false);
        context.SitePhoneNumbers.AddRange(changes.Phones);
        await context.SaveChangesAsync().ConfigureAwait(false);
    }
}
