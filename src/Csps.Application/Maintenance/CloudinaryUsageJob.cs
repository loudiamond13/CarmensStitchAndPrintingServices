using Csps.Application.Images;
using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>Placeholder so the tests compile; the real job follows in the next commit.</summary>
/// <param name="storage">The photo storage.</param>
/// <param name="uploadSettings">The upload limits.</param>
public sealed class CloudinaryUsageJob(IImageStorage storage, ImageUploadSettings uploadSettings) : IMaintenanceJob
{
    /// <inheritdoc />
    public int Order => 40;

    /// <inheritdoc />
    public string Name => "cloudinary-usage";

    /// <inheritdoc />
    public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken) =>
        Task.FromResult(new MaintenanceJobReport(storage is null || uploadSettings is null ? [] : [], false));
}
