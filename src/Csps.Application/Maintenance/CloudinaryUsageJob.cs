using System.Globalization;
using Csps.Application.Images;
using Csps.Application.Ports;

namespace Csps.Application.Maintenance;

/// <summary>
/// Reports how full the free Cloudinary plan is in every run (JOB-01, JOB-02, D-24, D-36). Above 80% of the plan, or when the plan's
/// photo size limit is below the app's upload limit, or when usage cannot be read, a line fails so the run turns red before an upload
/// breaks. Lines hold counts and fixed sentences only: never an address, a cloud name or a key.
/// </summary>
/// <param name="storage">The photo storage.</param>
/// <param name="uploadSettings">The upload limits, for the plan limit check.</param>
/// <param name="log">The server log for a storage read that failed.</param>
public sealed class CloudinaryUsageJob(IImageStorage storage, ImageUploadSettings uploadSettings, IMaintenanceJobLog log) : IMaintenanceJob
{
    /// <summary>The label of the storage line.</summary>
    public const string StorageLabel = "Cloudinary storage used";

    /// <summary>The label of the credits line.</summary>
    public const string CreditsLabel = "Cloudinary credits this month";

    /// <summary>The label of the failed lines.</summary>
    public const string FailedLabel = "Photo storage";

    /// <summary>The share of the plan, in percent, above which the run turns red.</summary>
    public const double AlarmPercent = 80;

    /// <summary>The failed line for a plan that is nearly full.</summary>
    public const string OverEightyText = "Over 80% of the free Cloudinary plan. Check usage before it runs out.";

    /// <summary>The failed line for a plan whose photo size limit is below the upload limit.</summary>
    public const string LimitBelowUploadText = "The Cloudinary plan's photo size limit is below the app's upload limit. Lower Images:MaxBytes.";

    /// <summary>The failed line for usage that could not be read.</summary>
    public const string UnreadableText = "Cloudinary usage could not be read.";

    /// <summary>The label of the line for storage that is not set up.</summary>
    public const string NotCheckedLabel = "Cloudinary usage not checked";

    /// <summary>The text of the line for storage that is not set up.</summary>
    public const string NotCheckedText = "photo storage is not set up.";

    private const double BytesPerGigabyte = 1024d * 1024 * 1024;

    /// <inheritdoc />
    public int Order => 40;

    /// <inheritdoc />
    public string Name => "cloudinary-usage";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        if (!storage.IsConfigured)
        {
            return Report(new MaintenanceLine(NotCheckedLabel, null, false, NotCheckedText));
        }

        StorageUsage usage;
        try
        {
            usage = await storage.GetUsageAsync(cancellationToken).ConfigureAwait(false);
        }
        catch (ImageStorageException failure)
        {
            log.StorageReadFailed(Name, failure.FailureCode);
            return Report(Failed(UnreadableText));
        }

        var lines = new List<MaintenanceLine>
        {
            Plain(StorageLabel, string.Create(CultureInfo.InvariantCulture, $"{usage.StorageBytes / BytesPerGigabyte:0.00} GB")),
            Plain(CreditsLabel, string.Create(CultureInfo.InvariantCulture, $"{Number(usage.CreditsUsed)} of {Number(usage.CreditsLimit)} ({Number(usage.CreditsPercent)}%)")),
        };

        if (usage.CreditsPercent > AlarmPercent || usage.StoragePercent > AlarmPercent)
        {
            lines.Add(Failed(OverEightyText));
        }

        if (usage.ImageMaxBytes > 0 && usage.ImageMaxBytes < uploadSettings.MaxBytes)
        {
            lines.Add(Failed(LimitBelowUploadText));
        }

        return new MaintenanceJobReport(lines, false);
    }

    private static string Number(double value) => value.ToString("0.##", CultureInfo.InvariantCulture);

    private static MaintenanceLine Plain(string label, string text) => new(label, null, false, text);

    private static MaintenanceLine Failed(string text) => new(FailedLabel, null, true, text);

    private static MaintenanceJobReport Report(MaintenanceLine line) => new([line], false);
}
