namespace Csps.Domain.Identity;

/// <summary>One single-use refresh token of a session. Only its SHA-256 hash is stored.</summary>
public sealed class RefreshToken
{
    // Used by EF Core (constructor binding) and by the session.
    private RefreshToken(
        Guid id,
        Guid sessionId,
        Guid? parentId,
        byte[] tokenHash,
        DateTimeOffset issuedAt,
        DateTimeOffset? consumedAt,
        DateTimeOffset? revokedAt)
    {
        Id = id;
        SessionId = sessionId;
        ParentId = parentId;
        TokenHash = tokenHash;
        IssuedAt = issuedAt;
        ConsumedAt = consumedAt;
        RevokedAt = revokedAt;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The session this token belongs to.</summary>
    public Guid SessionId { get; private set; }

    /// <summary>The token this one was issued for; null for the first token.</summary>
    public Guid? ParentId { get; private set; }

    /// <summary>The 32-byte SHA-256 hash of the token held by the browser.</summary>
    public byte[] TokenHash { get; private set; }

    /// <summary>When the token was issued.</summary>
    public DateTimeOffset IssuedAt { get; private set; }

    /// <summary>When the token was used; null while unused.</summary>
    public DateTimeOffset? ConsumedAt { get; private set; }

    /// <summary>When the token was revoked; null while not.</summary>
    public DateTimeOffset? RevokedAt { get; private set; }

    internal static RefreshToken Issue(Guid sessionId, Guid? parentId, ReadOnlySpan<byte> tokenHash, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), sessionId, parentId, tokenHash.ToArray(), now, null, null);

    internal void Consume(DateTimeOffset now) => ConsumedAt = now;

    internal void Revoke(DateTimeOffset now) => RevokedAt = now;
}
