using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>Removes old quote requests that never became orders (INQ-07). RED scaffold: removes nothing yet.</summary>
/// <param name="context">The database context.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="queue">The photo removal queue.</param>
/// <param name="logger">The logger.</param>
#pragma warning disable CS9113, IDE0060 // The scaffold does not use its dependencies yet.
internal sealed class QuoteRequestRetentionJob(
    CspsDbContext context,
    IBusinessCalendar calendar,
    IImageDeletionQueue queue,
    ILogger<QuoteRequestRetentionJob> logger) : IMaintenanceJob
#pragma warning restore CS9113, IDE0060
{
    internal const string RemovedLabel = "Old quote requests removed";

    internal const string JobName = "quote-request-retention";

    internal const int BatchSize = 0;

    /// <inheritdoc />
    public int Order => 0;

    /// <inheritdoc />
    public string Name => JobName;

    /// <inheritdoc />
    public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken) =>
        Task.FromResult(new MaintenanceJobReport([new MaintenanceLine(RemovedLabel, 0, false, null)], false));
}
