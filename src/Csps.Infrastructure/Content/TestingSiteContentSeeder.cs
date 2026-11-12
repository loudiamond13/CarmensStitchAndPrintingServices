#if CSPS_TESTING
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Puts the demo business info and the two demo phone numbers in place for E2E specs (QUAL-05). Every value is clearly fake. It saves
/// through the context's interceptors, so the public cache is cleared like after any real change. Debug builds only. Later plans
/// extend it for their own tables, deleting rows whose name starts with "E2E-"; this plan's tables have no such rows.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
public sealed class TestingSiteContentSeeder(CspsDbContext context, TimeProvider time)
{
    private static readonly SemaphoreSlim Gate = new(1, 1);

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

    /// <summary>Sets the demo settings and replaces the phone list with the two demo numbers.</summary>
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
        }
        finally
        {
            Gate.Release();
        }
    }
}
#endif
