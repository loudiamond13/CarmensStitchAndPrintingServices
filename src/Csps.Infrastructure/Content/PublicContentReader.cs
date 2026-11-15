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
/// <param name="delivery">Makes the photo addresses.</param>
internal sealed class PublicContentReader(HybridCache cache, IDbContextFactory<CspsDbContext> contextFactory, TimeProvider time, IImageDelivery delivery) : IPublicContentReader
{
    internal const string SiteCacheKey = "csps:public:site:v1";

    internal const string LinesCacheKey = "csps:public:lines:v1";

    internal const string HomeCacheKey = "csps:public:home:v1";

    internal const string GalleryCacheKey = "csps:public:gallery:v1";

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

    public ValueTask<PublicProductLinesSnapshot> GetProductLinesAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(LinesCacheKey, LoadLinesAsync, EntryOptions, Tags, cancellationToken);

    public ValueTask<PublicHomeSnapshot> GetHomeAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(HomeCacheKey, LoadHomeAsync, EntryOptions, Tags, cancellationToken);

    public ValueTask<PublicGallerySnapshot> GetGalleryAsync(CancellationToken cancellationToken) =>
        cache.GetOrCreateAsync(GalleryCacheKey, LoadGalleryAsync, EntryOptions, Tags, cancellationToken);

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
                    row.UpdatedAtUtc ?? row.CreatedAtUtc,
                    row.SharePicturePublicId))
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

            // The closures that touch the next 60 days: the open status skips them and the page head lists them as closed days.
            var (zone, source) = TimeZoneResolver.Resolve(settings.TimeZoneId);
            var clock = new BusinessClock(zone, source, time.GetUtcNow());
            var today = clock.Today;
            var windowEnd = today.AddDays(ShopClosure.SearchWindowDays);
            var closures = await db.ShopClosures
                .AsNoTracking()
                .Where(row => row.LastDay >= today && row.FirstDay <= windowEnd)
                .OrderBy(row => row.FirstDay)
                .ThenBy(row => row.LastDay)
                .Select(row => new ClosureRow(row.FirstDay, row.LastDay, row.Note, row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            return Build(settings, phones, hours, closures, clock);
        }
    }

    private async ValueTask<PublicProductLinesSnapshot> LoadLinesAsync(CancellationToken cancellationToken)
    {
        var db = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            // Position first, then the id of the row, so lines that share a position always come in the same order.
            var rows = await db.ProductLines
                .AsNoTracking()
                .Where(row => row.IsActive)
                .OrderBy(row => row.Position)
                .ThenBy(row => row.Id)
                .Select(row => new LineRow(
                    row.Id,
                    row.Key,
                    row.Number,
                    row.Title,
                    row.ShortName,
                    row.CardText,
                    row.Description,
                    row.FabricText,
                    row.CollarText,
                    row.CutText,
                    row.NamesText,
                    row.LogosText,
                    row.StartsAtPrice,
                    row.MinimumQuantity,
                    row.PlaceholderArt,
                    row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            // A line has gallery items when the one gallery projection holds a public item under it.
            var withItems = (await PublicGalleryProjection.LoadAsync(db, cancellationToken).ConfigureAwait(false)).Items.Select(item => item.LineId).ToHashSet();
            var lineIds = rows.Select(row => row.Id).ToList();
            var photos = await db.ProductLinePhotos
                .AsNoTracking()
                .Where(photo => lineIds.Contains(photo.LineId))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            PublicPhotoDto? PhotoOf(Guid lineId, ProductLinePhotoSlot slot) =>
                photos.Find(photo => photo.LineId == lineId && photo.Slot == slot) is { } found ? ProductLinePhotoMapper.ToPublic(found, delivery) : null;

            var lines = new PublicProductLinesDto(
            [
                .. rows.Select(row => new PublicProductLineDto(
                    row.Key,
                    row.Number,
                    row.Title,
                    row.ShortName,
                    row.CardText,
                    row.Description,
                    new PublicCustomizeDto(row.FabricText, row.CollarText, row.CutText, row.NamesText, row.LogosText),
                    row.StartsAtPrice,
                    row.MinimumQuantity,
                    ArtName(row.PlaceholderArt),
                    new PublicLinePhotosDto(PhotoOf(row.Id, ProductLinePhotoSlot.Main), PhotoOf(row.Id, ProductLinePhotoSlot.Back), PhotoOf(row.Id, ProductLinePhotoSlot.Fabric)),
                    HasGalleryItems: withItems.Contains(row.Id))),
            ]);
            var json = JsonSerializer.Serialize(lines, JsonOptions);
            var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
            var lastChanged = rows.Select(row => row.ChangedAtUtc)
                .Concat(photos.Select(photo => photo.UpdatedAtUtc ?? photo.CreatedAtUtc))
                .DefaultIfEmpty(DateTimeOffset.MinValue)
                .Max();
            return new PublicProductLinesSnapshot(lines, new PublicJsonSnapshot(json, etag, lastChanged), ShareImageOf(rows, photos));
        }
    }

    // The Home page: the shown lines as cards with their main photo at the card sizes, and the first three shown testimonials in order.
    private async ValueTask<PublicHomeSnapshot> LoadHomeAsync(CancellationToken cancellationToken)
    {
        var db = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            var rows = await db.ProductLines
                .AsNoTracking()
                .Where(row => row.IsActive)
                .OrderBy(row => row.Position)
                .ThenBy(row => row.Id)
                .Select(row => new HomeLineRow(row.Id, row.Key, row.Number, row.Title, row.CardText, row.PlaceholderArt, row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var lineIds = rows.Select(row => row.Id).ToList();
            var mains = await db.ProductLinePhotos
                .AsNoTracking()
                .Where(photo => lineIds.Contains(photo.LineId) && photo.Slot == ProductLinePhotoSlot.Main)
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);
            var testimonials = await db.Testimonials
                .AsNoTracking()
                .Where(row => row.IsShown)
                .OrderBy(row => row.Position)
                .ThenBy(row => row.Id)
                .Take(GetPublicHomeHandler.TestimonialLimit)
                .Select(row => new TestimonialRow(row.Quote, row.Name, row.TeamOrRole, row.Stars, row.UpdatedAtUtc ?? row.CreatedAtUtc))
                .ToListAsync(cancellationToken)
                .ConfigureAwait(false);

            // Recent work is the six newest shown orders by their shown date, whatever the gallery order is; an upload has no shown date and never
            // appears. The hero tag is the newest one.
            var recent = (await PublicGalleryProjection.LoadAsync(db, cancellationToken).ConfigureAwait(false)).Items
                .Where(item => item.Kind == GalleryEntryKind.Order)
                .OrderByDescending(item => item.ShownSinceUtc)
                .ThenByDescending(item => item.Id)
                .Take(6)
                .ToList();

            var home = new PublicHomeDto(
                [
                    .. rows.Select(row => new PublicHomeLineDto(
                        row.Key,
                        row.Number,
                        row.Title,
                        row.CardText,
                        ArtName(row.PlaceholderArt),
                        mains.Find(photo => photo.LineId == row.Id) is { } main ? ProductLinePhotoMapper.ToPublicCard(main, delivery) : null)),
                ],
                rows.Count,
                [.. testimonials.Select(row => new PublicTestimonialDto(row.Quote, row.Name, row.TeamOrRole, row.Stars))],
                [.. recent.Select(RecentWorkOf)],
                recent.Count == 0 ? null : new PublicHeroTagDto(recent[0].Team, recent[0].Pieces ?? 0));
            var json = JsonSerializer.Serialize(home, JsonOptions);
            var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
            var lastChanged = rows.Select(row => row.ChangedAtUtc)
                .Concat(mains.Select(photo => photo.UpdatedAtUtc ?? photo.CreatedAtUtc))
                .Concat(testimonials.Select(row => row.ChangedAtUtc))
                .Concat(recent.Select(item => item.ChangedAtUtc))
                .DefaultIfEmpty(DateTimeOffset.MinValue)
                .Max();
            return new PublicHomeSnapshot(home, new PublicJsonSnapshot(json, etag, lastChanged));
        }
    }

    // The Gallery: the public items from the one projection, with the addresses made here and never stored. A photo the delivery has no
    // address for is left out of its item, which then shows the line's drawing.
    private async ValueTask<PublicGallerySnapshot> LoadGalleryAsync(CancellationToken cancellationToken)
    {
        var db = await contextFactory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            var read = await PublicGalleryProjection.LoadAsync(db, cancellationToken).ConfigureAwait(false);
            var items = read.Items.Select(row => new PublicGalleryItemDto(
                row.Id,
                row.Team,
                row.LineKey,
                row.LineShortName,
                row.Pieces,
                row.Note,
                row.Art,
                [.. row.Photos.Select(photo => (Photo: photo, Urls: delivery.ForGallery(photo.PublicId, photo.Width, photo.Height)))
                    .Where(pair => pair.Urls.Masonry.Src.Length > 0)
                    .Select(pair => new PublicGalleryPhotoDto(
                        pair.Urls.Masonry.Src,
                        pair.Urls.Masonry.SrcSet,
                        pair.Urls.Viewer.Src,
                        pair.Urls.Viewer.SrcSet,
                        pair.Urls.Thumb,
                        pair.Photo.Width,
                        pair.Photo.Height))]))
                .ToList();
            var pills = read.ShownLines
                .Select(line => new PublicGalleryPillDto(line.Key, line.ShortName, read.Items.Count(row => row.LineId == line.Id)))
                .Where(pill => pill.Count > 0)
                .ToList();

            var gallery = new PublicGalleryDto(items, pills, items.Count);
            var json = JsonSerializer.Serialize(gallery, JsonOptions);
            var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
            var lastChanged = read.Items.Select(row => row.ChangedAtUtc).DefaultIfEmpty(DateTimeOffset.MinValue).Max();
            return new PublicGallerySnapshot(gallery, new PublicJsonSnapshot(json, etag, lastChanged), ShareImageOf(read));
        }
    }

    // One tile of the Recent work strip: the cover photo at the 4:5 strip sizes, or none when the delivery has no address.
    private PublicRecentWorkDto RecentWorkOf(PublicGalleryRow item)
    {
        var cover = item.Photos[0];
        var strip = delivery.ForStrip(cover.PublicId, cover.Width, cover.Height);
        return new PublicRecentWorkDto(
            item.Team,
            item.LineKey,
            item.LineShortName,
            item.Pieces,
            item.Art,
            strip.Src.Length == 0 ? null : new PublicPhotoDto(strip.Src, strip.SrcSet, cover.Width, cover.Height));
    }

    // The cover photo of the item at the top of the gallery as the link preview picture; none when there is no item or no address.
    private string? ShareImageOf(PublicGalleryRead read)
    {
        if (read.Items.Count == 0)
        {
            return null;
        }

        var cover = read.Items[0].Photos[0];
        var address = delivery.ForShare(cover.PublicId);
        return address.Length == 0 ? null : address;
    }

    // The first shown line's main photo as the link preview picture; none when it has no main photo or the delivery has no address.
    private string? ShareImageOf(List<LineRow> rows, List<ProductLinePhoto> photos)
    {
        if (rows.Count == 0 || photos.Find(photo => photo.LineId == rows[0].Id && photo.Slot == ProductLinePhotoSlot.Main) is not { } main)
        {
            return null;
        }

        var address = delivery.ForShare(main.PublicId);
        return address.Length == 0 ? null : address;
    }

    // "LongSleeves" is sent as "longSleeves", like every other JSON name.
    private static string ArtName(PlaceholderArt art) => PublicGalleryProjection.ArtName(art);

    // The default share picture as the 1200 x 630 link preview address; none when no picture is set or the delivery has no address.
    private string? DefaultShareImageOf(SettingsRow settings)
    {
        if (settings.SharePicturePublicId is not { } publicId)
        {
            return null;
        }

        var address = delivery.ForShare(publicId);
        return address.Length == 0 ? null : address;
    }

    private PublicSiteSnapshot Build(SettingsRow settings, List<PhoneRow> phones, List<HoursRow> hours, List<ClosureRow> closures, BusinessClock clock)
    {
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
            clock.Year,
            [.. hours.Select(day => new DayHoursDto(day.Day, DayHoursDto.FormatTime(day.OpensAt), DayHoursDto.FormatTime(day.ClosesAt)))],
            [.. closures
                .Where(closure => closure.FirstDay <= clock.Today.AddDays(ShopClosure.PublicWindowDays))
                .Select(closure => new PublicClosureDto(ShopClosureDto.FormatDay(closure.FirstDay), ShopClosureDto.FormatDay(closure.LastDay), closure.Note))]);

        var json = JsonSerializer.Serialize(site, JsonOptions);
        var etag = $"\"{Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(json)))}\"";
        var lastChanged = phones.Select(phone => phone.ChangedAtUtc)
            .Concat(hours.Select(day => day.ChangedAtUtc))
            .Concat(closures.Select(closure => closure.ChangedAtUtc))
            .Append(settings.ChangedAtUtc)
            .Max();
        return new PublicSiteSnapshot(
            site,
            new PublicJsonSnapshot(json, etag, lastChanged),
            [.. closures.Select(closure => new ClosureSpan(closure.FirstDay, closure.LastDay, closure.Note))],
            DefaultShareImageOf(settings));
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
        DateTimeOffset ChangedAtUtc,
        string? SharePicturePublicId);

    private sealed record LineRow(
        Guid Id,
        string Key,
        string Number,
        string Title,
        string ShortName,
        string CardText,
        string Description,
        string FabricText,
        string CollarText,
        string CutText,
        string NamesText,
        string LogosText,
        decimal? StartsAtPrice,
        int? MinimumQuantity,
        PlaceholderArt PlaceholderArt,
        DateTimeOffset ChangedAtUtc);

    private sealed record HomeLineRow(Guid Id, string Key, string Number, string Title, string CardText, PlaceholderArt PlaceholderArt, DateTimeOffset ChangedAtUtc);

    private sealed record TestimonialRow(string Quote, string Name, string? TeamOrRole, int Stars, DateTimeOffset ChangedAtUtc);

    private sealed record ClosureRow(DateOnly FirstDay, DateOnly LastDay, string? Note, DateTimeOffset ChangedAtUtc);

    private sealed record HoursRow(int Day, TimeOnly? OpensAt, TimeOnly? ClosesAt, DateTimeOffset ChangedAtUtc);

    private sealed record PhoneRow(string Number, string? Label, bool IsMain, DateTimeOffset ChangedAtUtc);
}
