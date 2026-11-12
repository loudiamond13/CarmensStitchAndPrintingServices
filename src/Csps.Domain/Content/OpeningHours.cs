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

    /// <summary>
    /// Sets this day's hours. Both times set is an open day, neither is a closed day, and one alone is refused. A failure changes
    /// nothing.
    /// </summary>
    /// <param name="opensAt">The opening time, or null for a closed day.</param>
    /// <param name="closesAt">The closing time, or null for a closed day.</param>
    /// <returns>The change, null when the hours are the same, or a validation error naming <c>opensAt</c> or <c>closesAt</c>.</returns>
    public Result<OpeningHoursChange?> SetHours(TimeOnly? opensAt, TimeOnly? closesAt)
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

        if (errors.Count > 0)
        {
            return Result.Failure<OpeningHoursChange?>(Error.Validation(InvalidCode, InvalidMessage, errors));
        }

        if (opensAt == OpensAt && closesAt == ClosesAt)
        {
            return Result.Success<OpeningHoursChange?>(null);
        }

        var change = new OpeningHoursChange(DayOfWeek, OpensAt, ClosesAt, opensAt, closesAt);
        OpensAt = opensAt;
        ClosesAt = closesAt;
        return Result.Success<OpeningHoursChange?>(change);
    }
}
