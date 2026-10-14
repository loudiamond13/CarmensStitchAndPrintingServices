using Csps.Application.Ports;
using Csps.Domain.Time;

namespace Csps.Infrastructure.Time;

/// <summary>
/// Builds the <see cref="BusinessClock"/> from <see cref="TimeProvider"/> and the cached SiteSettings zone. The clock
/// itself is never cached: the settings read is already cached, and a zone edit invalidates it through
/// <see cref="ISiteSettingsCache"/>.
/// </summary>
internal sealed class BusinessCalendar(TimeProvider timeProvider, ISiteSettingsReader settings) : IBusinessCalendar
{
    public async ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken)
    {
        var snapshot = await settings.GetAsync(cancellationToken).ConfigureAwait(false);
        var (zone, source) = TimeZoneResolver.Resolve(snapshot.TimeZoneId);
        return new BusinessClock(zone, source, timeProvider.GetUtcNow());
    }
}
