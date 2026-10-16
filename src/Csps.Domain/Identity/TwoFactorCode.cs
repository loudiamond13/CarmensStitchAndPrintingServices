namespace Csps.Domain.Identity;

/// <summary>One emailed code. Only its MAC is stored, never the code itself.</summary>
public sealed class TwoFactorCode
{
    // Used by EF Core (constructor binding) and by the challenge.
    private TwoFactorCode(
        Guid id,
        Guid challengeId,
        byte[] codeMac,
        DateTimeOffset issuedAt,
        DateTimeOffset expiresAt,
        int failedAttempts,
        DateTimeOffset? supersededAt,
        DateTimeOffset? consumedAt)
    {
        Id = id;
        ChallengeId = challengeId;
        CodeMac = codeMac;
        IssuedAt = issuedAt;
        ExpiresAt = expiresAt;
        FailedAttempts = failedAttempts;
        SupersededAt = supersededAt;
        ConsumedAt = consumedAt;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The challenge this code belongs to.</summary>
    public Guid ChallengeId { get; private set; }

    /// <summary>The 32-byte MAC of the code.</summary>
    public byte[] CodeMac { get; private set; }

    /// <summary>When the code was issued.</summary>
    public DateTimeOffset IssuedAt { get; private set; }

    /// <summary>When the code stops working.</summary>
    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>Wrong tries so far.</summary>
    public int FailedAttempts { get; private set; }

    /// <summary>When a newer code replaced this one; null while it is the newest.</summary>
    public DateTimeOffset? SupersededAt { get; private set; }

    /// <summary>When the code was accepted; null until then.</summary>
    public DateTimeOffset? ConsumedAt { get; private set; }

    internal static TwoFactorCode Issue(
        Guid challengeId, ReadOnlySpan<byte> codeMac, DateTimeOffset now, TimeSpan lifetime) =>
        new(Guid.CreateVersion7(now), challengeId, codeMac.ToArray(), now, now + lifetime, 0, null, null);

    internal void Consume(DateTimeOffset now) => ConsumedAt = now;

    internal void Supersede(DateTimeOffset now) => SupersededAt = now;

    internal void RecordFailure() => FailedAttempts++;
}
