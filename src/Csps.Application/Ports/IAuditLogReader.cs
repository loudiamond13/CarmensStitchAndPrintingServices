using Csps.Application.Users;

namespace Csps.Application.Ports;

/// <summary>Read-only access to the audit log for the Manager viewer (AUDIT-02). Nothing here writes: the log is append-only (D-25).</summary>
public interface IAuditLogReader
{
    /// <summary>
    /// Reads one page of entries inside the range, newest first: by time, then by id, so equal times keep their write order and paging
    /// is stable. The people named on the page are read from their own rows, so a deleted person keeps their name (D-08, D-11).
    /// </summary>
    /// <param name="query">The checked range and page.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The page and the number of entries in the range.</returns>
    Task<AuditLogPage> ListAsync(AuditLogQuery query, CancellationToken cancellationToken);
}

/// <summary>A checked audit query.</summary>
/// <param name="StartUtc">The first instant included.</param>
/// <param name="EndUtcExclusive">The first instant left out.</param>
/// <param name="Page">The page number, from 1.</param>
/// <param name="PageSize">Entries per page, from 1 to 100.</param>
public sealed record AuditLogQuery(DateTimeOffset StartUtc, DateTimeOffset EndUtcExclusive, int Page, int PageSize);

/// <summary>One stored entry with the people it names resolved. It carries only what the log stores (D-40).</summary>
/// <param name="Id">The entry id; later entries have higher ids.</param>
/// <param name="OccurredAt">When it happened, in UTC.</param>
/// <param name="Actor">The signed-in person who caused it; null when there was none.</param>
/// <param name="Action">The action code.</param>
/// <param name="TargetType">The kind of thing acted on, <c>User</c> or <c>UserSession</c>; null when none.</param>
/// <param name="Target">The person acted on: the user, or the owner of the session; null when there is none.</param>
/// <param name="Detail">The stored fixed-word detail; null when none.</param>
/// <param name="IpPrefix">The stored /24 or /48 prefix; null when unknown.</param>
/// <param name="Device">The stored browser family; null when unknown.</param>
/// <param name="Reference">The correlation id of the request.</param>
public sealed record AuditLogEntryView(
    long Id,
    DateTimeOffset OccurredAt,
    ActorRef? Actor,
    string Action,
    string? TargetType,
    ActorRef? Target,
    string? Detail,
    string? IpPrefix,
    string? Device,
    string Reference);

/// <summary>One page of audit entries and the number in the range.</summary>
/// <param name="Items">The entries of the page.</param>
/// <param name="Total">All entries in the range.</param>
public sealed record AuditLogPage(IReadOnlyList<AuditLogEntryView> Items, int Total);
