namespace Csps.Domain.Content;

/// <summary>How far away the next opening is, so the page can say "today", "tomorrow" or the weekday.</summary>
public enum NextOpeningWhen
{
    /// <summary>The shop opens later today.</summary>
    Today = 1,

    /// <summary>The shop opens tomorrow.</summary>
    Tomorrow = 2,

    /// <summary>The shop opens on a later day.</summary>
    Weekday = 3,
}

/// <summary>The next time the shop opens (D-22).</summary>
/// <param name="Date">The business date of the opening.</param>
/// <param name="Day">The weekday of that date.</param>
/// <param name="OpensAt">The opening time on that date.</param>
/// <param name="When">Whether the opening is today, tomorrow or later.</param>
public sealed record NextOpening(DateOnly Date, DayOfWeek Day, TimeOnly OpensAt, NextOpeningWhen When);
