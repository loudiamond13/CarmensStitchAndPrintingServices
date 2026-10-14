using Csps.Application.Ports;
using Csps.Domain.Time;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Csps.Infrastructure.Health;

/// <summary>
/// The <c>time-zone</c> health check (FND-06, D-02, D-23): Healthy when the zone stored in SiteSettings resolves,
/// Degraded when only a fallback zone does. A missing settings row surfaces as Unhealthy through the health
/// service. No description is attached.
/// </summary>
internal sealed class TimeZoneHealthCheck(IBusinessCalendar calendar) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        return clock.Source == ZoneSource.Stored ? HealthCheckResult.Healthy() : HealthCheckResult.Degraded();
    }
}
