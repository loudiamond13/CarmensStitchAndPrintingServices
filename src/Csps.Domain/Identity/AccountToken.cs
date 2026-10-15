namespace Csps.Domain.Identity;

/// <summary>What an account link token is for. The numbers are stored, so never renumber them.</summary>
public enum AccountTokenPurpose : byte
{
    /// <summary>A password reset link (AUTH-08).</summary>
    PasswordReset = 1,

    /// <summary>An invitation link (D-29). Phase 5 adds email-change confirmation here (D-28) without a schema change.</summary>
    Invitation = 2,
}

/// <summary>
/// A single-use link token for an account (reset, invitation). Only the SHA-256 of the token is kept. Every rule is a
/// function of the <c>now</c> the caller passes in.
/// </summary>
public sealed class AccountToken
{
    // Used by EF Core (constructor binding) and by Create.
    private AccountToken(
        Guid id,
        Guid userId,
        AccountTokenPurpose purpose,
        byte[] tokenHash,
        DateTimeOffset createdAt,
        DateTimeOffset expiresAt,
        DateTimeOffset? usedAt,
        DateTimeOffset? revokedAt,
        byte[] rowVersion)
    {
        Id = id;
        UserId = userId;
        Purpose = purpose;
        TokenHash = tokenHash;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
        UsedAt = usedAt;
        RevokedAt = revokedAt;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The account the link belongs to.</summary>
    public Guid UserId { get; private set; }

    /// <summary>What the link is for.</summary>
    public AccountTokenPurpose Purpose { get; private set; }

    /// <summary>The 32-byte SHA-256 hash of the token in the emailed link.</summary>
    public byte[] TokenHash { get; private set; }

    /// <summary>When the token was issued.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>When the token stops working.</summary>
    public DateTimeOffset ExpiresAt { get; private set; }

    /// <summary>When the token was used; null while unused.</summary>
    public DateTimeOffset? UsedAt { get; private set; }

    /// <summary>When a newer link replaced the token; null while not.</summary>
    public DateTimeOffset? RevokedAt { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict), so a link works once.</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>Issues a token.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="purpose">What the link is for.</param>
    /// <param name="tokenHash">SHA-256 of the token in the link.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="lifetime">How long the token works.</param>
    /// <returns>A new, unsaved token.</returns>
    /// <exception cref="ArgumentException"><paramref name="tokenHash"/> is not 32 bytes.</exception>
    /// <exception cref="ArgumentOutOfRangeException">The purpose is unknown or the lifetime is not positive.</exception>
    public static AccountToken Create(Guid userId, AccountTokenPurpose purpose, ReadOnlySpan<byte> tokenHash, DateTimeOffset now, TimeSpan lifetime)
    {
        if (!Enum.IsDefined(purpose))
        {
            throw new ArgumentOutOfRangeException(nameof(purpose), purpose, "The purpose is not known.");
        }

        ArgumentOutOfRangeException.ThrowIfLessThanOrEqual(lifetime, TimeSpan.Zero);
        if (tokenHash.Length != Identity.TokenHash.HashLength)
        {
            throw new ArgumentException("The value must be a 32-byte hash.", nameof(tokenHash));
        }

        return new AccountToken(Guid.CreateVersion7(now), userId, purpose, tokenHash.ToArray(), now, now + lifetime, null, null, []);
    }

    /// <summary>Tells whether the token still works: not used, not revoked and not past its expiry.</summary>
    /// <param name="now">The current instant.</param>
    /// <returns>True while usable.</returns>
    public bool IsUsable(DateTimeOffset now) => UsedAt is null && RevokedAt is null && now < ExpiresAt;

    /// <summary>Spends the token.</summary>
    /// <param name="now">The current instant.</param>
    /// <exception cref="InvalidOperationException">The token is used, revoked or expired.</exception>
    public void Use(DateTimeOffset now)
    {
        if (!IsUsable(now))
        {
            throw new InvalidOperationException("The token cannot be used.");
        }

        UsedAt = now;
    }

    /// <summary>Cancels an unused token. A used or already revoked token is left as it is.</summary>
    /// <param name="now">The current instant.</param>
    public void Revoke(DateTimeOffset now)
    {
        if (UsedAt is null && RevokedAt is null)
        {
            RevokedAt = now;
        }
    }
}
