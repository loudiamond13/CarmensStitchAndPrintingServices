namespace Csps.Domain.Content;

/// <summary>
/// The shop's hours for one weekday (D-21). A day with no opening or no closing time is a closed day. Times are
/// local business time and the closing time is always after the opening time, so a day never runs past midnight.
/// </summary>
/// <param name="Day">The weekday these hours belong to.</param>
/// <param name="OpensAt">When the shop opens, or null on a closed day.</param>
/// <param name="ClosesAt">When the shop closes, or null on a closed day.</param>
public sealed record DayHours(DayOfWeek Day, TimeOnly? OpensAt, TimeOnly? ClosesAt)
{
    /// <summary>True when both an opening and a closing time are set.</summary>
    public bool IsOpenDay => OpensAt is not null && ClosesAt is not null;
}
