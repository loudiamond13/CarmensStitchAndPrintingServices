using Csps.Application.Maintenance;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Analytics;

/// <summary>Compile-only stub; the rollup and the purges arrive in the next commit.</summary>
internal sealed class AnalyticsRetentionJob(
    CspsDbContext context,
    IBusinessCalendar calendar,
    IMaintenanceCursors cursors,
    TimeProvider time,
    ILogger<AnalyticsRetentionJob> logger) : IMaintenanceJob
{
    internal const string RolledUpLabel = "Visitor days rolled up";

    /// <inheritdoc />
    public int Order => 15;

    /// <inheritdoc />
    public string Name => "analytics-retention";

    /// <inheritdoc />
    public Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        _ = (context, calendar, cursors, time, logger);
        return Task.FromResult(new MaintenanceJobReport([], false));
    }
}
