using Csps.Application.Ports;
using Csps.Domain.Time;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>The business calendar of the trial import: the given clock in the Asia/Manila business zone.</summary>
internal sealed class ToolCalendar(TimeProvider time) : IBusinessCalendar
{
    private static readonly (TimeZoneInfo Zone, ZoneSource Source) Business = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana);

    public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
        ValueTask.FromResult(new BusinessClock(Business.Zone, Business.Source, time.GetUtcNow()));
}
