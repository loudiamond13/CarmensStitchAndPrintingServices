using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Keeps the SiteSettings singleton at the D-04 seed values: the real business name and the UI-spec contact
/// placeholders. Recreates the row when it is missing. When the row already matches, nothing is written, so the
/// row version stays the same.
/// </summary>
public sealed class SiteSettingsSeedStep : ISeedStep
{
    /// <inheritdoc />
    public int Order => 100;

    /// <inheritdoc />
    public string Name => "SiteSettings";

    /// <inheritdoc />
    public async Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(time);

        var now = time.GetUtcNow();
        var settings = await db.SiteSettings
            .SingleOrDefaultAsync(row => row.Id == SiteSettings.SingletonId, cancellationToken)
            .ConfigureAwait(false);

        if (settings is null)
        {
            db.SiteSettings.Add(SiteSettings.CreateDefault(now));
            return true;
        }

        return settings.ResetToSeedDefaults(now);
    }
}
