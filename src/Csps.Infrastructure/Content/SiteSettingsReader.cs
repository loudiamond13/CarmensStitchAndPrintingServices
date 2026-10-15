using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Reads the SiteSettings singleton through the in-process HybridCache (FND-09, D-02, D-10). The entry lives
/// for an hour, or until <see cref="InvalidateAsync"/> marks everything tagged <c>site-settings</c> as stale.
/// The cache factory creates its own context, because it can outlive the request that started it (WR-01).
/// </summary>
internal sealed class SiteSettingsReader(HybridCache cache, IDbContextFactory<CspsDbContext> contextFactory) : ISiteSettingsReader, ISiteSettingsCache
{
    internal const string CacheKey = "csps:site-settings:v1";

    internal const string CacheTag = "site-settings";

    internal const string MissingRowMessage =
        "The SiteSettings singleton row (Id = 1) is missing. Apply the EF migrations.";

    private static readonly string[] Tags = [CacheTag];

    private static readonly HybridCacheEntryOptions EntryOptions = new()
    {
        Expiration = TimeSpan.FromHours(1),
        LocalCacheExpiration = TimeSpan.FromHours(1),
    };

    public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(CacheKey, LoadAsync, EntryOptions, Tags, cancellationToken);

    // Logical invalidation: entries created before this call are ignored from now on.
    public ValueTask InvalidateAsync(CancellationToken cancellationToken) =>
        cache.RemoveByTagAsync(CacheTag, cancellationToken);

    private async ValueTask<SiteSettingsSnapshot> LoadAsync(CancellationToken cancellationToken)
    {
        var db = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            return await Query(db, cancellationToken).ConfigureAwait(false);
        }
    }

    private static async Task<SiteSettingsSnapshot> Query(CspsDbContext db, CancellationToken cancellationToken) =>
        await db.SiteSettings
            .AsNoTracking()
            .Where(settings => settings.Id == SiteSettings.SingletonId)
            .Select(settings => new SiteSettingsSnapshot(
                settings.BusinessName,
                settings.TimeZoneId,
                settings.CurrencyCode,
                settings.Locale,
                settings.ContactEmail,
                settings.ContactPhone,
                settings.AddressLine,
                settings.FacebookUrl,
                Convert.ToBase64String(settings.RowVersion)))
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false)
        ?? throw new InvalidOperationException(MissingRowMessage);
}
