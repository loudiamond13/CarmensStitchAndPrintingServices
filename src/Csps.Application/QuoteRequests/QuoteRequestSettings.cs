namespace Csps.Application.QuoteRequests;

/// <summary>The configurable limits of the quote form (section <c>QuoteRequests</c>, INQ-02).</summary>
public sealed class QuoteRequestSettings
{
    /// <summary>The configuration section name.</summary>
    public const string SectionName = "QuoteRequests";

    /// <summary>The shortest upload key lifetime.</summary>
    public static readonly TimeSpan MinUploadKeyLifetime = TimeSpan.FromMinutes(5);

    /// <summary>The longest upload key lifetime.</summary>
    public static readonly TimeSpan MaxUploadKeyLifetime = TimeSpan.FromHours(24);

    /// <summary>The longest minimum time to submit, in seconds.</summary>
    public const int MaxMinimumSeconds = 60;

    /// <summary>The shortest form ticket lifetime.</summary>
    public static readonly TimeSpan MinTicketLifetime = TimeSpan.FromHours(1);

    /// <summary>The longest form ticket lifetime.</summary>
    public static readonly TimeSpan MaxTicketLifetime = TimeSpan.FromHours(72);

    /// <summary>Gets or sets how long a visitor's upload key works after the request is saved; from 5 minutes to 24 hours.</summary>
    public TimeSpan UploadKeyLifetime { get; set; } = TimeSpan.FromHours(2);

    /// <summary>Gets or sets the fewest seconds between the form ticket and the send; a faster send is caught as a bot. It only stops a send made at once, because a ticket can be used again (D-40). From 0 to 60 (D-25).</summary>
    public int MinimumSeconds { get; set; } = 3;

    /// <summary>The most requests one sender can be allowed in a day.</summary>
    public const int MaxPerSenderPerDay = 50;

    /// <summary>The window of the per-sender limit: a request counts for 24 hours after it is received.</summary>
    public static readonly TimeSpan SenderWindow = TimeSpan.FromHours(24);

    /// <summary>Gets or sets how many requests one mobile number or one email may send in 24 hours; from 1 to 50 (D-37).</summary>
    public int PerSenderPerDay { get; set; } = 3;

    /// <summary>Gets or sets how many staff alert emails are sent in one business hour (D-09).</summary>
    public int AlertsPerHour { get; set; } = 20;

    /// <summary>Gets or sets how long a form ticket stays good; from 1 to 72 hours. An older ticket is a 400 so a real visitor can send again.</summary>
    public TimeSpan TicketLifetime { get; set; } = TimeSpan.FromHours(24);

    /// <summary>Tells whether the values are usable.</summary>
    /// <returns>Null when they are, otherwise a plain message naming the first bad value.</returns>
    public string? Validate()
    {
        if (UploadKeyLifetime < MinUploadKeyLifetime || UploadKeyLifetime > MaxUploadKeyLifetime)
        {
            return $"{SectionName}:UploadKeyLifetime must be from 5 minutes to 24 hours.";
        }

        if (MinimumSeconds is < 0 or > MaxMinimumSeconds)
        {
            return $"{SectionName}:MinimumSeconds must be from 0 to {MaxMinimumSeconds}.";
        }

        if (PerSenderPerDay is < 1 or > MaxPerSenderPerDay)
        {
            return $"{SectionName}:PerSenderPerDay must be from 1 to {MaxPerSenderPerDay}.";
        }

        return TicketLifetime < MinTicketLifetime || TicketLifetime > MaxTicketLifetime
            ? $"{SectionName}:TicketLifetime must be from 1 to 72 hours."
            : null;
    }
}
