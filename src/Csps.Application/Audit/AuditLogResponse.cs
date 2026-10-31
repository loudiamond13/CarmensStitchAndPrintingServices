using Csps.Application.Users;

namespace Csps.Application.Audit;

/// <summary>The kinds of <see cref="DoneBy"/>.</summary>
public static class DoneByKinds
{
    /// <summary>A person did it; <see cref="DoneBy.Person"/> names them.</summary>
    public const string User = "user";

    /// <summary>The system did it: a job or a command with no signed-in person.</summary>
    public const string System = "system";

    /// <summary>A sign-in failed for an address that matches no account, so no person is named.</summary>
    public const string UnknownAccount = "unknown-account";
}

/// <summary>Who did it (D-27).</summary>
/// <param name="Kind">One of <see cref="DoneByKinds"/>.</param>
/// <param name="Person">The person for kind <c>user</c>; null for the other kinds.</param>
public sealed record DoneBy(string Kind, ActorRef? Person);

/// <summary>One audit entry as the viewer shows it (D-27). The detail is the stored fixed words: field names and role values, never names or emails (D-40).</summary>
/// <param name="Id">The entry id.</param>
/// <param name="OccurredAt">When it happened, in UTC.</param>
/// <param name="DoneBy">Who did it.</param>
/// <param name="Action">The action code, for example <c>user.deactivated</c>.</param>
/// <param name="DoneTo">The person it was done to; null when there is none.</param>
/// <param name="Detail">The stored detail; null when none.</param>
/// <param name="IpPrefix">The client network, /24 or /48; null when unknown.</param>
/// <param name="Device">The browser family; null when unknown.</param>
/// <param name="Reference">The correlation id, to find the request's log lines.</param>
/// <param name="Changes">The typed "What changed" lines of an expense, order or list entry; empty for every other entry (D-27, D-31).</param>
/// <param name="Snapshot">The facts of an added, deleted, restored or permanently deleted expense; null otherwise (D-27).</param>
/// <param name="OrderSnapshot">The facts of a deleted, restored or permanently deleted order, readable after the order is gone; null otherwise (ORD-16).</param>
/// <param name="OrderNumber">The number of the order an order or order child entry is about; null for every other entry.</param>
public sealed record AuditLogItem(
    long Id,
    DateTimeOffset OccurredAt,
    DoneBy DoneBy,
    string Action,
    ActorRef? DoneTo,
    string? Detail,
    string? IpPrefix,
    string? Device,
    string Reference,
    IReadOnlyList<AuditChangeLine> Changes,
    AuditExpenseSnapshot? Snapshot,
    AuditOrderSnapshot? OrderSnapshot,
    string? OrderNumber);

/// <summary>One page of the audit log, newest first (AUDIT-02).</summary>
/// <param name="Items">The entries of this page.</param>
/// <param name="Total">How many entries match, across all pages.</param>
/// <param name="Page">The page number asked for.</param>
/// <param name="PageSize">The page size asked for.</param>
public sealed record AuditLogResponse(IReadOnlyList<AuditLogItem> Items, int Total, int Page, int PageSize);
