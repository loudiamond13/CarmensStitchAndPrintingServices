using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Domain.Time;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Csps.Infrastructure.Content;

/// <summary>
/// Reads what the public site shows through the in-process HybridCache (PUB-02, CONT-05). The snapshot lives for an hour, which also
/// refreshes the year without a write, or until a content change clears everything tagged <c>public-content</c>. The cache factory
/// creates its own context, because it can outlive the request that started it. The shop email is never selected.
/// </summary>
/// <param name="cache">The cache.</param>
/// <param name="contextFactory">Makes the short-lived contexts the cache factory reads with.</param>
/// <param name="time">The clock, for the business-calendar year.</param>
internal sealed class PublicContentReader(HybridCache cache, IDbContextFactory<CspsDbContext> contextFactory, TimeProvider time) : IPublicContentReader
{
    internal const string SiteCacheKey = "csps:public:site:v1";

    internal const string MissingHoursMessage =
        "The seven OpeningHours rows are missing. Apply the EF migrations.";

    internal const string MissingRowMessage =
        "The SiteSettings singleton row (Id = 1) is missing. Apply the EF migrations.";

    private static readonly string[] Tags = [PublicCacheTags.PublicContent];

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private static readonly HybridCacheEntryOptions EntryOptions = new()
    {
        Expiration = TimeSpan.FromHours(1),
        LocalCacheExpiration = TimeSpan.FromHours(1),
    };

    public ValueTask<PublicSiteSnapshot> GetSiteAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(SiteCacheKey, LoadSiteAsync, EntryOptions, Tags, cancellationToken);

    private async ValueTask<PublicSiteSnapshot> LoadSiteAsync(CancellationToken cancellationToken)
    {
        var db = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            var settings = await db.SiteSettings
                .AsNoTracking()
                .Where(row => row.Id == SiteSettings.SingletonId)
                .Select(row => new SettingsRow(
                    row.BusinessName,
                    row.Tagline,
                    row.AboutText,
                    row.TurnaroundLine,
                    row.Street,
                    row.TownOrCity,
                    row.Province,
                    row.PostalCode,
                    row.MessengerUrl,
                    row.FacebookUrl,
                    row.InstagramUrl,
                    row.TikTokUrl,
                    row.DirectionsUrl,
                    row.MapEmbedUrl,
                    row.TimeZoneId,
                    row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .SingleOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false)
                ?? throw new InvalidOperationException(MissingRowMessage);

            var hours = await db.OpeningHours
                .AsNoTracking()
                .OrderBy(row => row.DayOfWeek)
                .Select(row => new HoursRow(row.DayOfWeek, row.OpensAt, row.ClosesAt, row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            if (hours.Count != OpeningHours.DayCount)
            {
                throw new InvalidOperationException(MissingHoursMessage);
            }

            var phones = await db.SitePhoneNumbers
                .AsNoTracking()
                .OrderByDescending(row => row.IsMain)
                .ThenBy(row => row.Position)
                .Select(row => new PhoneRow(row.Number, row.Label, row.IsMain, row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            return Build(settings, phones, hours);
        }
    }

    private PublicSiteSnapshot Build(SettingsRow settings, List<PhoneRow> phones, List<HoursRow> hours)
    {
        var (zone, source) = TimeZoneResolver.Resolve(settings.TimeZoneId);
        var year = new BusinessClock(zone, source, time.GetUtcNow()).Year;
        var site = new PublicSiteDto(
            settings.BusinessName,
            settings.Tagline,
            settings.AboutText,
            settings.TurnaroundLine,
            new PublicAddressDto(settings.Street, settings.TownOrCity, settings.Province, settings.PostalCode),
            [.. phones.Select(phone => new PublicPhoneDto(DisplayOf(phone.Number), phone.Number, phone.Label, phone.IsMain))],
            settings.MessengerUrl,
            NullWhenEmpty(settings.FacebookUrl),
            settings.InstagramUrl,
            settings.TikTokUrl,
            settings.DirectionsUrl,
            settings.MapEmbedUrl,
            year,
            [.. hours.Select(day => new DayHoursDto(day.Day, DayHoursDto.FormatTime(day.OpensAt), DayHoursDto.FormatTime(day.ClosesAt)))],
            []);

        var json = JsonSerializer.Serialize(site, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        var lastChanged = phones.Select(phone => phone.ChangedAtUtc).Concat(hours.Select(day => day.ChangedAtUtc)).Append(settings.ChangedAtUtc).Max();
        return new PublicSiteSnapshot(site, new PublicJsonSnapshot(json, etag, lastChanged));
    }

    private static string DisplayOf(string number) => PhilippinePhone.TryParse(number, out var phone) ? phone.Display : number;

    // The Facebook column is required, so "not set" is stored as an empty string.
    private static string? NullWhenEmpty(string value) => value.Length == 0 ? null : value;

    private sealed record SettingsRow(
        string BusinessName,
        string Tagline,
        string? AboutText,
        string? TurnaroundLine,
        string? Street,
        string? TownOrCity,
        string? Province,
        string? PostalCode,
        string? MessengerUrl,
        string FacebookUrl,
        string? InstagramUrl,
        string? TikTokUrl,
        string? DirectionsUrl,
        string? MapEmbedUrl,
        string TimeZoneId,
        DateTimeOffset ChangedAtUtc);

    private sealed record HoursRow(int Day, TimeOnly? OpensAt, TimeOnly? ClosesAt, DateTimeOffset ChangedAtUtc);

    private sealed record PhoneRow(string Number, string? Label, bool IsMain, DateTimeOffset ChangedAtUtc);
}
