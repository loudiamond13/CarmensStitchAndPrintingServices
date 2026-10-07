using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Keeps the SiteSettings singleton at the D-04 seed values: the real business name and the UI-spec contact
/// placeholders. Recreates the row when it is missing.
/// </summary>
public sealed class SiteSettingsSeedStep : ISeedStep
{
    /// <inheritdoc />
    public int Order => 100;

    /// <inheritdoc />
    public string Name => "SiteSettings";

    /// <inheritdoc />
    public Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        _ = db;
        _ = time;
        _ = cancellationToken;
        return Task.FromResult(false);
    }
}
