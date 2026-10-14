using Csps.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Csps.Infrastructure.Health;

/// <summary>
/// The <c>database</c> health check (FND-06, D-23): Healthy when a connection opens, Unhealthy otherwise. No
/// description or exception is attached, so nothing about the server or the failure can reach the response.
/// </summary>
internal sealed class DatabaseHealthCheck(CspsDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default) =>
        await db.Database.CanConnectAsync(cancellationToken).ConfigureAwait(false)
            ? HealthCheckResult.Healthy()
            : HealthCheckResult.Unhealthy();
}
