using System.Net;

namespace Csps.Domain.Auditing;

/// <summary>
/// One row of the append-only audit log (FND-10, PRD section 11.4). An entry is written once and never
/// changed: there are no mutators, and the database rejects UPDATE and DELETE (D-25). The record is
/// minimized before it exists (D-24, RA 10173): the client IP is kept only as its /24 or /48 prefix and the
/// User-Agent only as a family label, so neither raw value ever reaches storage.
/// </summary>
/// <remarks>
/// <see cref="Create"/> throws <see cref="ArgumentException"/> for bad input. Callers are application code
/// with constant actions and server-made correlation ids, so a failure is a programming error, not a user
/// mistake. <see cref="Detail"/> is plain text and must never hold secrets, codes or JSON.
/// </remarks>
public sealed class AuditEntry
{
    /// <summary>Maximum length of <see cref="Action"/> in UTF-16 code units.</summary>
    public const int ActionMaxLength = 64;

    /// <summary>Maximum length of <see cref="TargetType"/> in UTF-16 code units.</summary>
    public const int TargetTypeMaxLength = 64;

    /// <summary>Maximum length of <see cref="TargetId"/> in UTF-16 code units.</summary>
    public const int TargetIdMaxLength = 64;

    /// <summary>Maximum length of <see cref="IpPrefix"/>: the longest textual IPv6 form.</summary>
    public const int IpPrefixMaxLength = 45;

    /// <summary>Maximum length of <see cref="UserAgentFamily"/> in UTF-16 code units.</summary>
    public const int UserAgentFamilyMaxLength = 32;

    /// <summary>Exact length of <see cref="CorrelationId"/>: a W3C trace id, 32 lowercase hex characters.</summary>
    public const int CorrelationIdLength = 32;

    /// <summary>Maximum length of <see cref="Detail"/> in UTF-16 code units.</summary>
    public const int DetailMaxLength = 400;

    // Used by EF Core (constructor binding) and by Create.
    private AuditEntry(
        long id,
        DateTimeOffset occurredAtUtc,
        Guid? actorUserId,
        string action,
        string? targetType,
        string? targetId,
        string? ipPrefix,
        string? userAgentFamily,
        string correlationId,
        string? detail)
    {
        Id = id;
        OccurredAtUtc = occurredAtUtc;
        ActorUserId = actorUserId;
        Action = action;
        TargetType = targetType;
        TargetId = targetId;
        IpPrefix = ipPrefix;
        UserAgentFamily = userAgentFamily;
        CorrelationId = correlationId;
        Detail = detail;
    }

    /// <summary>Database identity; 0 until the row is saved.</summary>
    public long Id { get; private set; }

    /// <summary>When the event happened, always with a zero offset (UTC).</summary>
    public DateTimeOffset OccurredAtUtc { get; private set; }

    /// <summary>The signed-in user who caused the event; null for anonymous or system events.</summary>
    public Guid? ActorUserId { get; private set; }

    /// <summary>What happened, as a dotted lowercase code such as <c>auth.sign-in-failed</c>.</summary>
    public string Action { get; private set; }

    /// <summary>The kind of thing acted on, for example <c>Order</c>; null when there is none.</summary>
    public string? TargetType { get; private set; }

    /// <summary>The id of the thing acted on; null when there is none.</summary>
    public string? TargetId { get; private set; }

    /// <summary>The client address truncated to /24 (IPv4) or /48 (IPv6); null when unknown.</summary>
    public string? IpPrefix { get; private set; }

    /// <summary>The User-Agent family label from <see cref="Auditing.UserAgentFamily"/>.</summary>
    public string? UserAgentFamily { get; private set; }

    /// <summary>The request's trace id, used to find every record and log line for one request.</summary>
    public string CorrelationId { get; private set; }

    /// <summary>Optional plain-text note. Never secrets, codes or JSON.</summary>
    public string? Detail { get; private set; }

    /// <summary>
    /// Builds a minimized, validated audit record from raw request facts. The raw IP and User-Agent are
    /// reduced here and are not kept anywhere on the entry.
    /// </summary>
    /// <param name="occurredAtUtc">When it happened, read from <c>TimeProvider</c>; the offset must be zero.</param>
    /// <param name="actorUserId">The signed-in user, or null.</param>
    /// <param name="action">A dotted code: two or more segments of lowercase letters, digits and hyphens.</param>
    /// <param name="targetType">The kind of thing acted on, or null; at most 64 characters.</param>
    /// <param name="targetId">The id of the thing acted on, or null; at most 64 characters.</param>
    /// <param name="remoteIp">The connection's remote address, or null.</param>
    /// <param name="userAgent">The raw User-Agent header, or null.</param>
    /// <param name="correlationId">Exactly 32 lowercase hex characters.</param>
    /// <param name="detail">Optional plain-text note; at most 400 characters.</param>
    /// <returns>A new, unsaved entry.</returns>
    /// <exception cref="ArgumentNullException"><paramref name="action"/> or <paramref name="correlationId"/> is null.</exception>
    /// <exception cref="ArgumentException">Any other value breaks the rules above.</exception>
    public static AuditEntry Create(
        DateTimeOffset occurredAtUtc,
        Guid? actorUserId,
        string action,
        string? targetType,
        string? targetId,
        IPAddress? remoteIp,
        string? userAgent,
        string correlationId,
        string? detail)
    {
        ArgumentNullException.ThrowIfNull(action);
        ArgumentNullException.ThrowIfNull(correlationId);

        if (occurredAtUtc.Offset != TimeSpan.Zero)
        {
            throw new ArgumentException("The audit time must be in UTC (zero offset).", nameof(occurredAtUtc));
        }

        if (!IsValidAction(action))
        {
            throw new ArgumentException(
                "The audit action must be 1 to 64 characters: two or more dot-separated parts of lowercase letters, digits and hyphens.",
                nameof(action));
        }

        EnsureMaxLength(targetType, TargetTypeMaxLength, nameof(targetType));
        EnsureMaxLength(targetId, TargetIdMaxLength, nameof(targetId));
        EnsureMaxLength(detail, DetailMaxLength, nameof(detail));

        if (!IsValidCorrelationId(correlationId))
        {
            throw new ArgumentException(
                "The correlation id must be exactly 32 lowercase hex characters.",
                nameof(correlationId));
        }

        return new AuditEntry(
            id: 0,
            occurredAtUtc,
            actorUserId,
            action,
            targetType,
            targetId,
            Auditing.IpPrefix.From(remoteIp),
            Auditing.UserAgentFamily.Classify(userAgent),
            correlationId,
            detail);
    }

    private static void EnsureMaxLength(string? value, int maxLength, string paramName)
    {
        if (value?.Length > maxLength)
        {
            throw new ArgumentException($"The value must be at most {maxLength} characters.", paramName);
        }
    }

    // A simple character loop instead of a regular expression (CWE-1333).
    private static bool IsValidAction(string action)
    {
        if (action.Length is 0 or > ActionMaxLength)
        {
            return false;
        }

        var segments = 1;
        var segmentLength = 0;
        foreach (var c in action)
        {
            if (c == '.')
            {
                if (segmentLength == 0)
                {
                    return false;
                }

                segments++;
                segmentLength = 0;
            }
            else if (c is (>= 'a' and <= 'z') or (>= '0' and <= '9') or '-')
            {
                segmentLength++;
            }
            else
            {
                return false;
            }
        }

        return segmentLength > 0 && segments >= 2;
    }

    private static bool IsValidCorrelationId(string correlationId)
    {
        if (correlationId.Length != CorrelationIdLength)
        {
            return false;
        }

        foreach (var c in correlationId)
        {
            if (c is not ((>= '0' and <= '9') or (>= 'a' and <= 'f')))
            {
                return false;
            }
        }

        return true;
    }
}
