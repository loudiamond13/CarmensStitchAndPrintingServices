using System.Net;

namespace Csps.Domain.Auditing;

/// <summary>One append-only audit record (FND-10).</summary>
public sealed class AuditEntry
{
    /// <summary>Maximum length of <see cref="Action"/>.</summary>
    public const int ActionMaxLength = 64;

    /// <summary>Maximum length of <see cref="TargetType"/>.</summary>
    public const int TargetTypeMaxLength = 64;

    /// <summary>Maximum length of <see cref="TargetId"/>.</summary>
    public const int TargetIdMaxLength = 64;

    /// <summary>Maximum length of <see cref="IpPrefix"/>.</summary>
    public const int IpPrefixMaxLength = 45;

    /// <summary>Maximum length of <see cref="UserAgentFamily"/>.</summary>
    public const int UserAgentFamilyMaxLength = 32;

    /// <summary>Exact length of <see cref="CorrelationId"/>.</summary>
    public const int CorrelationIdLength = 32;

    /// <summary>Maximum length of <see cref="Detail"/>.</summary>
    public const int DetailMaxLength = 400;

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

    /// <summary>Database identity.</summary>
    public long Id { get; private set; }

    /// <summary>When it happened (UTC).</summary>
    public DateTimeOffset OccurredAtUtc { get; private set; }

    /// <summary>Who did it.</summary>
    public Guid? ActorUserId { get; private set; }

    /// <summary>What happened.</summary>
    public string Action { get; private set; }

    /// <summary>Target type.</summary>
    public string? TargetType { get; private set; }

    /// <summary>Target id.</summary>
    public string? TargetId { get; private set; }

    /// <summary>Truncated client address.</summary>
    public string? IpPrefix { get; private set; }

    /// <summary>User-agent family label.</summary>
    public string? UserAgentFamily { get; private set; }

    /// <summary>Correlation id.</summary>
    public string CorrelationId { get; private set; }

    /// <summary>Optional detail.</summary>
    public string? Detail { get; private set; }

    /// <summary>Creates an entry (stub: no validation or minimization yet).</summary>
    /// <param name="occurredAtUtc">When it happened.</param>
    /// <param name="actorUserId">Who did it.</param>
    /// <param name="action">What happened.</param>
    /// <param name="targetType">Target type.</param>
    /// <param name="targetId">Target id.</param>
    /// <param name="remoteIp">Remote address.</param>
    /// <param name="userAgent">User-Agent header.</param>
    /// <param name="correlationId">Correlation id.</param>
    /// <param name="detail">Optional detail.</param>
    /// <returns>A new, unsaved entry.</returns>
    public static AuditEntry Create(
        DateTimeOffset occurredAtUtc,
        Guid? actorUserId,
        string action,
        string? targetType,
        string? targetId,
        IPAddress? remoteIp,
        string? userAgent,
        string correlationId,
        string? detail) =>
        new(
            0,
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
