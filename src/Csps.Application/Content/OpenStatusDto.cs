using System.Globalization;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>When the shop opens next, as facts the page turns into words (D-22).</summary>
/// <param name="Date">The business date of the opening, "yyyy-MM-dd".</param>
/// <param name="Day">The weekday of that date, 1 for Monday to 7 for Sunday.</param>
/// <param name="OpensAt">The opening time as "HH:mm" (24 hours).</param>
/// <param name="When">"today", "tomorrow" or "weekday".</param>
public sealed record NextOpeningDto(string Date, int Day, string OpensAt, string When);

/// <summary>
/// Whether the shop is open now, worked out by the server in business time (PUB-05, D-22). The page only turns these facts into words.
/// </summary>
/// <param name="IsOpen">True when the shop is open at this instant.</param>
/// <param name="ClosesAt">The closing time today as "HH:mm" when open; otherwise null.</param>
/// <param name="ClosedToday">True when a closure covers today.</param>
/// <param name="TodayClosureNote">The note of the closure that covers today; null when none or no note.</param>
/// <param name="NextOpening">The next opening within 14 days; null when open or when nothing opens in that time.</param>
public sealed record OpenStatusDto(bool IsOpen, string? ClosesAt, bool ClosedToday, string? TodayClosureNote, NextOpeningDto? NextOpening)
{
    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>Maps the domain answer to the DTO.</summary>
    /// <param name="status">The open status.</param>
    /// <returns>The DTO.</returns>
    public static OpenStatusDto From(OpenStatus status)
    {
        ArgumentNullException.ThrowIfNull(status);
        return new OpenStatusDto(
            status.IsOpen,
            DayHoursDto.FormatTime(status.ClosesAt),
            status.ClosedToday,
            status.TodayClosureNote,
            status.NextOpening is { } next
                ? new NextOpeningDto(
                    next.Date.ToString(DateFormat, CultureInfo.InvariantCulture),
                    WeekDay.ToNumber(next.Day),
                    DayHoursDto.FormatTime(next.OpensAt)!,
                    next.When.ToString().ToLowerInvariant())
                : null);
    }
}
