using Csps.Application.Maintenance;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Csps.Infrastructure.Maintenance;

/// <summary>
/// Removes request keys and idempotency claims whose time has passed (SEC-06, JOB-01). A database failure is logged and
/// reported as a failed line; the run never throws for it.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
/// <param name="logger">The logger.</param>
internal sealed partial class PurgeExpiredRecordsJob(CspsDbContext context, TimeProvider time, ILogger<PurgeExpiredRecordsJob> logger) : IMaintenanceJob
{
    internal const string RequestKeysLabel = "Expired request keys removed";

    internal const int BatchSize = 500;

    /// <inheritdoc />
    public int Order => 10;

    /// <inheritdoc />
    public string Name => "purge-expired-records";

    /// <inheritdoc />
    public async Task<MaintenanceJobReport> RunAsync(MaintenanceBudget budget, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(budget);

        var now = time.GetUtcNow();
        try
        {
            var records = await context.Set<IdempotencyRecord>()
                .Where(record => record.ExpiresAt <= now)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
            var claims = await context.Set<DatabaseLock>()
                .Where(claim => claim.ExpiresAtUtc != null && claim.ExpiresAtUtc <= now)
                .ExecuteDeleteAsync(cancellationToken)
                .ConfigureAwait(false);
            return new MaintenanceJobReport([new MaintenanceLine(RequestKeysLabel, records + claims, false, null)], false);
        }
        catch (Exception exception) when (SqlErrors.IsDatabaseFailure(exception))
        {
            LogPurgeFailed(logger, exception);
            return new MaintenanceJobReport([new MaintenanceLine(RequestKeysLabel, null, true, "The expired request keys could not be removed.")], false);
        }
    }

    [LoggerMessage(Level = LogLevel.Warning, Message = "Expired request keys could not be removed by the maintenance run.")]
    private static partial void LogPurgeFailed(ILogger logger, Exception exception);
}
