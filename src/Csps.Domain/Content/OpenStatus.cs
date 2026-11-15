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
    /// <summary>How many days after today the search for the next opening looks: the longest closure plus a week.</summary>
    public const int LookAheadDays = ShopClosure.MaxSpanDays + 7;

    /// <summary>Works out the open status at the clock's instant.</summary>
    /// <param name="clock">The business clock that carries the zone and the current instant.</param>
    /// <param name="week">The weekly hours. A weekday that is missing counts as closed.</param>
    /// <param name="closures">The closure spans.</param>
    /// <returns>The open status.</returns>
    public static OpenStatus Compute(BusinessClock clock, IReadOnlyList<DayHours> week, IReadOnlyList<ClosureSpan> closures)
    {
        var now = TimeOnly.FromDateTime(clock.LocalNow.DateTime);
        var today = clock.Today;
        var todayClosure = closures.FirstOrDefault(c => c.Covers(today));

        if (todayClosure is null && OpenHoursOn(week, today.DayOfWeek) is (var opens, var closes) && now >= opens && now < closes)
        {
            return new OpenStatus(true, closes, false, null, null);
        }

        return new OpenStatus(false, null, todayClosure is not null, todayClosure?.Note, FindNextOpening(today, now, week, closures));
    }

    private static NextOpening? FindNextOpening(DateOnly today, TimeOnly now, IReadOnlyList<DayHours> week, IReadOnlyList<ClosureSpan> closures)
    {
        for (var offset = 0; offset <= LookAheadDays; offset++)
        {
            var day = today.AddDays(offset);
            if (closures.Any(c => c.Covers(day)) || OpenHoursOn(week, day.DayOfWeek) is not (var opens, _))
            {
                continue;
            }

            // Today only counts when the shop has not opened yet; once it is open or past closing, look ahead.
            if (offset == 0 && now >= opens)
            {
                continue;
            }

            var when = offset switch
            {
                0 => NextOpeningWhen.Today,
                1 => NextOpeningWhen.Tomorrow,
                _ => NextOpeningWhen.Weekday,
            };
            return new NextOpening(day, day.DayOfWeek, opens, when);
        }

        return null;
    }

    private static (TimeOnly Opens, TimeOnly Closes)? OpenHoursOn(IReadOnlyList<DayHours> week, DayOfWeek day) =>
        week.FirstOrDefault(d => d.Day == day) is { OpensAt: { } opens, ClosesAt: { } closes } ? (opens, closes) : null;
}
