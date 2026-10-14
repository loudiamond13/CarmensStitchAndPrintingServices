using Csps.Domain.Time;

namespace Csps.Application.Ports;

/// <summary>
/// Business "now" (FND-08, D-02): the current instant from <c>TimeProvider</c> in the zone stored in SiteSettings,
/// resolved through the fallback chain. Every "today", month and year bucket starts here.
/// </summary>
public interface IBusinessCalendar
{
    /// <summary>Returns the business clock at the current instant.</summary>
    /// <param name="cancellationToken">Cancels the settings read.</param>
    /// <returns>The clock; its <see cref="BusinessClock.Source"/> shows whether the stored zone resolved.</returns>
    ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken);
}
