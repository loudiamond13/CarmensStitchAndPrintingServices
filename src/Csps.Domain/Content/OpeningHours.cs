using Csps.Domain.Common;

namespace Csps.Domain.Content;

/// <summary>What changed in one day's hours: the times before and after (AUDIT-01).</summary>
/// <param name="Day">The weekday, 1 for Monday to 7 for Sunday.</param>
/// <param name="OldOpensAt">The opening time before the change; null when the day was closed.</param>
/// <param name="OldClosesAt">The closing time before the change; null when the day was closed.</param>
/// <param name="NewOpensAt">The opening time after the change; null when the day is now closed.</param>
/// <param name="NewClosesAt">The closing time after the change; null when the day is now closed.</param>
public sealed record OpeningHoursChange(int Day, TimeOnly? OldOpensAt, TimeOnly? OldClosesAt, TimeOnly? NewOpensAt, TimeOnly? NewClosesAt);

/// <summary>
/// The shop's hours for one weekday (D-21, CONT-01). There are exactly seven rows, one per weekday, and the migration creates them with
/// every day closed: no hours are ever invented. A day is open when it has both an opening and a closing time, and closed when it has
/// neither. Times are local business time. The attribution members are set only by the database layer (SEC-08).
/// </summary>
public sealed class OpeningHours : IAttributedRecord, IPublicContentRecord
{
    /// <summary>The first weekday key, Monday.</summary>
    public const int FirstDay = 1;

    /// <summary>The last weekday key, Sunday.</summary>
    public const int LastDay = 7;

    /// <summary>How many rows the table holds.</summary>
    public const int DayCount = 7;

    /// <summary>The machine code of hours that break the rules.</summary>
    public const string InvalidCode = "opening-hours.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = SiteSettings.InvalidMessage;

    /// <summary>The message for an open day with no opening time.</summary>
    public const string OpeningTimeRequiredMessage = "Choose the opening time.";

    /// <summary>The message for an open day with no closing time.</summary>
    public const string ClosingTimeRequiredMessage = "Choose the closing time.";

    /// <summary>The message for a closing time that is not after the opening time.</summary>
    public const string ClosesAfterOpensMessage = "Closing time must be after opening time.";

    /// <summary>The message for a time that is not on the hour or half hour between 5:00 AM and 11:30 PM.</summary>
    public const string TimeStepMessage = "Choose a time on the hour or half hour, from 5:00 AM to 11:30 PM.";

    /// <summary>The minutes between the times a Manager can choose.</summary>
    public const int StepMinutes = 30;

    /// <summary>The earliest time a day can open.</summary>
    public static readonly TimeOnly EarliestOpening = new(5, 0);

    /// <summary>The latest time a day can open or close.</summary>
    public static readonly TimeOnly LatestTime = new(23, 30);

    // Used by EF Core (constructor binding) and by the migration's seed row values.
    private OpeningHours(
        int dayOfWeek,
        TimeOnly? opensAt,
        TimeOnly? closesAt,
        DateTimeOffset createdAtUtc,
        Guid? createdById,
        DateTimeOffset? updatedAtUtc,
        Guid? updatedById,
        byte[] rowVersion)
    {
        DayOfWeek = dayOfWeek;
        OpensAt = opensAt;
        ClosesAt = closesAt;
        CreatedAtUtc = createdAtUtc;
        CreatedById = createdById;
        UpdatedAtUtc = updatedAtUtc;
        UpdatedById = updatedById;
        RowVersion = rowVersion;
    }

    /// <summary>The weekday key: 1 for Monday to 7 for Sunday.</summary>
    public int DayOfWeek { get; private set; }

    /// <summary>Creates a closed day. The migration inserts the seven real rows; this is for tests and tools that need a row in memory.</summary>
    /// <param name="dayOfWeek">The weekday key, 1 for Monday to 7 for Sunday.</param>
    /// <param name="createdAtUtc">The creation instant.</param>
    /// <returns>A new, unsaved, closed day.</returns>
    public static OpeningHours Closed(int dayOfWeek, DateTimeOffset createdAtUtc)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(dayOfWeek, FirstDay);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(dayOfWeek, LastDay);
        return new OpeningHours(dayOfWeek, null, null, createdAtUtc, null, null, null, []);
    }

    /// <summary>When the shop opens; null on a closed day.</summary>
    public TimeOnly? OpensAt { get; private set; }

    /// <summary>When the shop closes; null on a closed day.</summary>
    public TimeOnly? ClosesAt { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Tells whether a time is one a Manager can choose: on the hour or half hour, from 5:00 AM to 11:30 PM.</summary>
    /// <param name="time">The time.</param>
    /// <returns>True when the time can be an opening or a closing time.</returns>
    public static bool IsChoosableTime(TimeOnly time) =>
        time >= EarliestOpening && time <= LatestTime && time.Ticks % (TimeSpan.TicksPerMinute * StepMinutes) == 0;

    /// <summary>
    /// Checks one day's two times against the rules, so the request validator and <see cref="SetHours"/> never disagree. An open day
    /// needs both times, each time must be choosable, and closing must be after opening.
    /// </summary>
    /// <param name="opensAt">The opening time, or null for none.</param>
    /// <param name="closesAt">The closing time, or null for none.</param>
    /// <returns>The messages by field name (<c>opensAt</c> or <c>closesAt</c>); empty when the hours are fine.</returns>
    public static Dictionary<string, string[]> Check(TimeOnly? opensAt, TimeOnly? closesAt)
    {
        var errors = new Dictionary<string, string[]>(StringComparer.Ordinal);
        if (opensAt is null && closesAt is not null)
        {
            errors["opensAt"] = [OpeningTimeRequiredMessage];
        }

        if (closesAt is null && opensAt is not null)
        {
            errors["closesAt"] = [ClosingTimeRequiredMessage];
        }

        if (opensAt is { } opens && !IsChoosableTime(opens))
        {
            errors["opensAt"] = [TimeStepMessage];
        }

        if (closesAt is { } closes && !IsChoosableTime(closes))
        {
            errors["closesAt"] = [TimeStepMessage];
        }

        if (errors.Count == 0 && opensAt is { } start && closesAt is { } end && end <= start)
        {
            errors["closesAt"] = [ClosesAfterOpensMessage];
        }

        return errors;
    }

    /// <summary>
    /// Sets this day's hours. Both times set is an open day and neither is a closed day; a time off the half hour or outside 5:00 AM to
    /// 11:30 PM, one time alone, and a closing time that is not after the opening time are refused. A failure changes nothing.
    /// </summary>
    /// <param name="opensAt">The opening time, or null for a closed day.</param>
    /// <param name="closesAt">The closing time, or null for a closed day.</param>
    /// <returns>The change, null when the hours are the same, or a validation error naming <c>opensAt</c> or <c>closesAt</c>.</returns>
    public Result<OpeningHoursChange?> SetHours(TimeOnly? opensAt, TimeOnly? closesAt)
    {
        var errors = Check(opensAt, closesAt);
        if (errors.Count > 0)
        {
            return Result.Failure<OpeningHoursChange?>(Error.Validation(InvalidCode, InvalidMessage, errors));
        }

        if (opensAt.Equals(OpensAt) && closesAt.Equals(ClosesAt))
        {
            return Result.Success<OpeningHoursChange?>(null);
        }

        var change = new OpeningHoursChange(DayOfWeek, OpensAt, ClosesAt, opensAt, closesAt);
        OpensAt = opensAt;
        ClosesAt = closesAt;
        return Result.Success<OpeningHoursChange?>(change);
    }
}
