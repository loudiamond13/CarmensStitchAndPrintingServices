using Csps.Application.Ports;
using Csps.Domain.Time;

namespace Csps.Testing;

/// <summary>A business calendar pinned to one instant in a fixed UTC+8 zone, so a reader test never reads site settings.</summary>
/// <param name="now">The instant the clock reports.</param>
public sealed class FixedBusinessCalendar(DateTimeOffset now) : IBusinessCalendar
{
    private static readonly TimeZoneInfo Zone = TimeZoneInfo.CreateCustomTimeZone("business", TimeSpan.FromHours(8), "business", "business");

    /// <inheritdoc />
    public ValueTask<BusinessClock> GetClockAsync(CancellationToken cancellationToken) =>
        ValueTask.FromResult(new BusinessClock(Zone, ZoneSource.Stored, now));
}
