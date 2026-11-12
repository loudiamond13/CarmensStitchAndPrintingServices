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
        "https://maps.example.test/directions",
        "https://maps.example.test/embed",
        "https://m.me/cspsdemo",
        "https://facebook.example.test/cspsdemo",
        "https://instagram.example.test/cspsdemo",
        "https://tiktok.example.test/cspsdemo",
        "shop-private@example.test",
        [new BusinessPhone("0917 123 4567", "Globe", IsMain: true), new BusinessPhone("02 8123 4567", null, IsMain: false)]);

    /// <summary>Gets business info with only the required values: no address, links, about text or phone numbers.</summary>
    /// <returns>The values.</returns>
    public static BusinessInfo Bare() => new(
        "Sample Shop", "Sample tagline", null, null, null, null, null, null, null, null, null, null, null, null, null, []);

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
