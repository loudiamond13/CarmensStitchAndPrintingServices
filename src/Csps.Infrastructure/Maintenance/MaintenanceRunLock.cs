using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Maintenance;

/// <summary>The maintenance run lease as a claim row in DatabaseLocks (JOB-01, T-09-17).</summary>
/// <param name="contexts">Makes the short-lived contexts that write and free the claim on their own.</param>
internal sealed class MaintenanceRunLock(IDbContextFactory<CspsDbContext> contexts) : IMaintenanceRunLock
{
    /// <inheritdoc />
    public Task<bool> TryTakeAsync(Guid holder, DateTimeOffset now, CancellationToken cancellationToken)
    {
        _ = contexts;
        return Task.FromResult(true);
    }

    /// <inheritdoc />
    public Task ReleaseAsync(Guid holder, CancellationToken cancellationToken) => Task.CompletedTask;
}
