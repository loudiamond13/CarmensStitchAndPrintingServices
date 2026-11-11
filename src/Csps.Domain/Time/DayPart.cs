namespace Csps.Domain.Time;

/// <summary>The part of the business day a greeting is for (DASH-01).</summary>
public enum DayPart
{
    /// <summary>Before 12:00 local time.</summary>
    Morning,

    /// <summary>From 12:00 to before 18:00 local time.</summary>
    Afternoon,

    /// <summary>From 18:00 local time.</summary>
    Evening,
}
