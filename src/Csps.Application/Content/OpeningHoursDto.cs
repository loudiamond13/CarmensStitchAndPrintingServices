using System.Globalization;
using Csps.Application.Ports;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>One weekday's hours as people send and read them. A closed day has no times.</summary>
/// <param name="Day">The weekday, 1 for Monday to 7 for Sunday.</param>
/// <param name="OpensAt">The opening time as "HH:mm" (24 hours); null on a closed day.</param>
/// <param name="ClosesAt">The closing time as "HH:mm" (24 hours); null on a closed day.</param>
public sealed record DayHoursDto(int Day, string? OpensAt, string? ClosesAt)
{
    /// <summary>The text form of a time of day: 24 hours, two digits each.</summary>
    public const string TimeFormat = "HH:mm";

    /// <summary>Writes a time as "HH:mm".</summary>
    /// <param name="time">The time; null stays null.</param>
    /// <returns>The text, or null.</returns>
    public static string? FormatTime(TimeOnly? time) => time?.ToString(TimeFormat, CultureInfo.InvariantCulture);

    /// <summary>Reads "HH:mm". Anything else, including an empty text, is not a time.</summary>
    /// <param name="text">The text.</param>
    /// <param name="time">The time when the text is well formed.</param>
    /// <returns>True when <paramref name="text"/> is exactly "HH:mm".</returns>
    public static bool TryParseTime(string? text, out TimeOnly time) =>
        TimeOnly.TryParseExact(text, TimeFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out time);

    /// <summary>Maps a domain day to the DTO.</summary>
    /// <param name="hours">The day.</param>
    /// <returns>The DTO.</returns>
    public static DayHoursDto From(DayHours hours)
    {
        ArgumentNullException.ThrowIfNull(hours);
        return new DayHoursDto(WeekDay.ToNumber(hours.Day), FormatTime(hours.OpensAt), FormatTime(hours.ClosesAt));
    }

    /// <summary>Maps the DTO to the domain day; a time that does not read as "HH:mm" counts as not set.</summary>
    /// <returns>The day.</returns>
    public DayHours ToDomain() =>
        new(WeekDay.FromNumber(Day), TryParseTime(OpensAt, out var opens) ? opens : null, TryParseTime(ClosesAt, out var closes) ? closes : null);
}

/// <summary>Converts between the API's weekday numbers (1 for Monday to 7 for Sunday) and <see cref="DayOfWeek"/>.</summary>
public static class WeekDay
{
    /// <summary>Gets the API number of a weekday.</summary>
    /// <param name="day">The weekday.</param>
    /// <returns>1 for Monday to 7 for Sunday.</returns>
    public static int ToNumber(DayOfWeek day) => day == DayOfWeek.Sunday ? 7 : (int)day;

    /// <summary>Gets the weekday of an API number.</summary>
    /// <param name="number">1 for Monday to 7 for Sunday.</param>
    /// <returns>The weekday.</returns>
    public static DayOfWeek FromNumber(int number) => number == 7 ? DayOfWeek.Sunday : (DayOfWeek)number;
}

/// <summary>
/// The staff view of the weekly hours (CONT-01, D-21): seven days, Monday first, the version a save must send back and who last changed
/// any day. The version belongs to the hours alone, so a Business Info save never makes it stale (P-8).
/// </summary>
/// <param name="Days">The seven days, Monday first.</param>
/// <param name="Version">The text a save must send back (409 on a stale one).</param>
/// <param name="UpdatedByName">The name of the person who last changed any day; null when no person did.</param>
/// <param name="UpdatedAtUtc">When any day was last changed; null until a change.</param>
public sealed record OpeningHoursDto(IReadOnlyList<DayHoursDto> Days, string Version, string? UpdatedByName, DateTimeOffset? UpdatedAtUtc)
{
    /// <summary>Maps the week view to the DTO (manual mapping, PRD section 3.3).</summary>
    /// <param name="view">The view.</param>
    /// <returns>The DTO.</returns>
    public static OpeningHoursDto From(OpeningHoursView view)
    {
        ArgumentNullException.ThrowIfNull(view);
        return new OpeningHoursDto(
            [.. view.Rows.Select(static row => new DayHoursDto(row.Day, DayHoursDto.FormatTime(row.OpensAt), DayHoursDto.FormatTime(row.ClosesAt)))],
            OpeningHoursVersion.ToText([.. view.Rows.Select(static row => row.RowVersion)]),
            view.UpdatedByName,
            view.UpdatedAtUtc);
    }
}
