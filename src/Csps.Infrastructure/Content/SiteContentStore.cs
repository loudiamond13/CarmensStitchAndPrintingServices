using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// <see cref="ISiteContentStore"/> over EF: the settings row and the phone rows are loaded as tracked rows and saved by the unit of
/// work, so the stamp, audit and cache-clearing interceptors all run. The staff read is never cached.
/// </summary>
internal sealed class SiteContentStore(CspsDbContext context) : ISiteContentStore
{
    internal const string MissingRowMessage =
        "The SiteSettings singleton row (Id = 1) is missing. Apply the EF migrations.";

    public async Task<SiteSettingsForUpdate> GetSettingsForUpdateAsync(CancellationToken cancellationToken)
    {
        var settings = await context.SiteSettings
            .SingleOrDefaultAsync(row => row.Id == SiteSettings.SingletonId, cancellationToken)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException(MissingRowMessage);
        var phones = await context.SitePhoneNumbers
            .OrderBy(row => row.Position)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return new SiteSettingsForUpdate(settings, phones);
    }

    public void ReplacePhones(IReadOnlyList<SitePhoneNumber> current, IReadOnlyList<SitePhoneNumber> replacement)
    {
        ArgumentNullException.ThrowIfNull(current);
        ArgumentNullException.ThrowIfNull(replacement);
        context.SitePhoneNumbers.RemoveRange(current);
        context.SitePhoneNumbers.AddRange(replacement);
    }

    // The last changer comes from the user row, so a rename shows at once and a deleted person keeps their name.
    public async Task<SiteSettingsView> GetViewAsync(CancellationToken cancellationToken)
    {
        var row = await (
            from settings in context.SiteSettings.AsNoTracking()
            where settings.Id == SiteSettings.SingletonId
            join changerUser in context.Users on settings.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                Settings = settings,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false)
            ?? throw new InvalidOperationException(MissingRowMessage);

        var phones = await context.SitePhoneNumbers
            .AsNoTracking()
            .OrderByDescending(phone => phone.IsMain)
            .ThenBy(phone => phone.Position)
            .Select(phone => new SitePhoneView(phone.Number, phone.Label, phone.IsMain))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        var settingsRow = row.Settings;
        return new SiteSettingsView(
            settingsRow.BusinessName,
            settingsRow.Tagline,
            settingsRow.AboutText,
            settingsRow.TurnaroundLine,
            settingsRow.Street,
            settingsRow.TownOrCity,
            settingsRow.Province,
            settingsRow.PostalCode,
            settingsRow.DirectionsUrl,
            settingsRow.MapEmbedUrl,
            settingsRow.MessengerUrl,
            settingsRow.FacebookUrl,
            settingsRow.InstagramUrl,
            settingsRow.TikTokUrl,
            settingsRow.ContactEmail,
            phones,
            settingsRow.TimeZoneId,
            settingsRow.CurrencyCode,
            settingsRow.Locale,
            settingsRow.RowVersion,
            row.ChangerFirst is null ? null : $"{row.ChangerFirst} {row.ChangerLast}",
            settingsRow.UpdatedAtUtc);
    }
}
