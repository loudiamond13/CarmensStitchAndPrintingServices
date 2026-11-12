using Csps.Domain.Time;

namespace Csps.Domain.Content;

/// <summary>
/// Whether the shop is open now and, if not, when it opens next (PUB-05, D-22). The answer is facts only; the
/// client turns it into words. The zone and "today" come only from the <see cref="BusinessClock"/>, never from the
/// machine or the visitor.
/// </summary>
/// <param name="IsOpen">True when the shop is open at this instant.</param>
/// <param name="ClosesAt">The closing time today when open, otherwise null.</param>
/// <param name="ClosedToday">True when a closure covers today.</param>
/// <param name="TodayClosureNote">The note of the closure that covers today, or null.</param>
/// <param name="NextOpening">The next opening within <see cref="LookAheadDays"/> days, or null when open or none.</param>
public sealed record OpenStatus(
    bool IsOpen,
    TimeOnly? ClosesAt,
    bool ClosedToday,
    string? TodayClosureNote,
    NextOpening? NextOpening)
{
    /// <summary>How many days after today the search for the next opening looks.</summary>
    public const int LookAheadDays = 14;

    /// <summary>Works out the open status at the clock's instant.</summary>
    /// <param name="clock">The business clock that carries the zone and the current instant.</param>
    /// <param name="week">The weekly hours. A weekday that is missing counts as closed.</param>
    /// <param name="closures">The closure spans.</param>
    /// <returns>The open status.</returns>
    public static OpenStatus Compute(BusinessClock clock, IReadOnlyList<DayHours> week, IReadOnlyList<ClosureSpan> closures)
    {
        return new OpenStatus(false, null, false, null, null);
    }
}
