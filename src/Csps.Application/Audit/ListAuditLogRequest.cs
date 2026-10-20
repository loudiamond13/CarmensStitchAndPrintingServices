using System.Globalization;

namespace Csps.Application.Audit;

/// <summary>The audit-log query (AUDIT-02, D-26). Every part is optional; with no dates the range is the last 7 business days.</summary>
/// <param name="From">The first business day, <c>YYYY-MM-DD</c> in the business zone; none means 6 days before today (or the start of the kept window when only <paramref name="To"/> is given).</param>
/// <param name="To">The last business day, <c>YYYY-MM-DD</c>; none means today.</param>
/// <param name="Actor">A user id, or <c>system</c>, to keep only what that person (or nobody) did.</param>
/// <param name="Action">An action code from <c>AuditActions.All</c>.</param>
/// <param name="Target">A user id, to keep only entries about that person, including their session events.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Entries per page, from 1 to 100.</param>
public sealed record ListAuditLogRequest(
    string? From = null,
    string? To = null,
    string? Actor = null,
    string? Action = null,
    string? Target = null,
    int Page = 1,
    int PageSize = ListAuditLogRequest.DefaultPageSize)
{
    /// <summary>The page size used when the caller sends none.</summary>
    public const int DefaultPageSize = 20;
}

/// <summary>How the audit-log filter text is read, shared by the validator and the handler so they always agree.</summary>
internal static class AuditLogFilters
{
    /// <summary>The value of <see cref="ListAuditLogRequest.Actor"/> that means "no signed-in person".</summary>
    public const string SystemActor = "system";

    private const string DateFormat = "yyyy-MM-dd";

    /// <summary>A blank value means the filter is not used.</summary>
    public static bool IsBlank(string? text) => string.IsNullOrWhiteSpace(text);

    /// <summary>Reads exactly <c>YYYY-MM-DD</c> and nothing else: no short forms, no times.</summary>
    public static bool TryParseDay(string? text, out DateOnly day) =>
        DateOnly.TryParseExact(text, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out day);

    /// <summary>Reads a GUID in the 36-character dashed form.</summary>
    public static bool TryParseId(string? text, out Guid id) => Guid.TryParseExact(text, "D", out id);
}
