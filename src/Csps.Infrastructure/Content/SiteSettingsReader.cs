using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>Reads the SiteSettings singleton.</summary>
internal sealed class SiteSettingsReader(CspsDbContext db) : ISiteSettingsReader, ISiteSettingsCache
{
    internal const string MissingRowMessage =
        "The SiteSettings singleton row (Id = 1) is missing. Apply the EF migrations.";

    public async ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
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

    public ValueTask InvalidateAsync(CancellationToken cancellationToken) => ValueTask.CompletedTask;
}
