namespace Csps.Domain.Identity;

/// <summary>
/// A signed-in device and its chain of single-use refresh tokens (AUTH-05, D-03, D-43). The session ends at a
/// fixed instant that rotation never moves. Every rule is a function of the <c>now</c> the caller passes in.
/// </summary>
public sealed class UserSession
{
    /// <summary>Maximum length of <see cref="DeviceLabel"/>.</summary>
    public const int DeviceLabelMaxLength = 60;

    // Used by EF Core (constructor binding) and by Start.
    private UserSession(
        Guid id,
        Guid userId,
        bool persistent,
        DateTimeOffset createdAt,
        DateTimeOffset absoluteExpiresAt,
        DateTimeOffset lastActiveAt,
        string deviceLabel,
        DateTimeOffset? revokedAt,
        SessionRevocationReason? revokedReason,
        byte[] rowVersion)
    {
        Id = id;
        UserId = userId;
        Persistent = persistent;
        CreatedAt = createdAt;
        AbsoluteExpiresAt = absoluteExpiresAt;
        LastActiveAt = lastActiveAt;
        DeviceLabel = deviceLabel;
        RevokedAt = revokedAt;
        RevokedReason = revokedReason;
        RowVersion = rowVersion;
    }

    /// <summary>Primary key.</summary>
    public Guid Id { get; private set; }

    /// <summary>The account.</summary>
    public Guid UserId { get; private set; }

    /// <summary>True when "Keep me signed in" was chosen (D-03).</summary>
    public bool Persistent { get; private set; }

    /// <summary>When the user signed in.</summary>
    public DateTimeOffset CreatedAt { get; private set; }

    /// <summary>The fixed end of the session; rotation never moves it.</summary>
    public DateTimeOffset AbsoluteExpiresAt { get; private set; }

    /// <summary>The last successful refresh, or the sign-in.</summary>
    public DateTimeOffset LastActiveAt { get; private set; }

    /// <summary>A coarse browser-and-device label (D-43), at most <see cref="DeviceLabelMaxLength"/> characters.</summary>
    public string DeviceLabel { get; private set; }

    /// <summary>When the session was revoked; null while not.</summary>
    public DateTimeOffset? RevokedAt { get; private set; }

    /// <summary>Why the session was revoked; null while not.</summary>
    public SessionRevocationReason? RevokedReason { get; private set; }

    /// <summary>Optimistic-concurrency token maintained by the database (409 on conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>When the refresh cookie expires: the session end for a persistent session, none for a browser session.</summary>
    public DateTimeOffset? CookieExpiresAt => Persistent ? AbsoluteExpiresAt : null;

    /// <summary>Starts a session with its first refresh token.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="persistent">Whether "Keep me signed in" was chosen.</param>
    /// <param name="deviceLabel">The coarse device label; longer text is cut to <see cref="DeviceLabelMaxLength"/>.</param>
    /// <param name="firstTokenHash">SHA-256 of the first refresh token.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">The lifetimes.</param>
    /// <returns>The new, unsaved session and its first token.</returns>
    /// <exception cref="ArgumentException"><paramref name="firstTokenHash"/> is not 32 bytes.</exception>
    public static (UserSession Session, RefreshToken Token) Start(
        Guid userId,
        bool persistent,
        string deviceLabel,
        ReadOnlySpan<byte> firstTokenHash,
        DateTimeOffset now,
        SessionSettings settings)
    {
        RequireHashLength(firstTokenHash, nameof(firstTokenHash));
        var label = deviceLabel.Length > DeviceLabelMaxLength ? deviceLabel[..DeviceLabelMaxLength] : deviceLabel;
        var session = new UserSession(
            Guid.CreateVersion7(now),
            userId,
            persistent,
            now,
            now + (persistent ? settings.PersistentLifetime : settings.BrowserSessionLifetime),
            now,
            label,
            null,
            null,
            []);
        return (session, RefreshToken.Issue(session.Id, null, firstTokenHash, now));
    }

    /// <summary>Uses a presented refresh token and issues its child (rule R1).</summary>
    /// <param name="presented">The token the browser sent.</param>
    /// <param name="related">Every token of this session the store loaded, including <paramref name="presented"/>.</param>
    /// <param name="newTokenHash">SHA-256 of the token to hand out.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="settings">The limits.</param>
    /// <returns>The decision and the new token.</returns>
    /// <exception cref="ArgumentException">The hash is not 32 bytes, or the token belongs to another session.</exception>
    public RotationResult Rotate(
        RefreshToken presented,
        IReadOnlyCollection<RefreshToken> related,
        ReadOnlySpan<byte> newTokenHash,
        DateTimeOffset now,
        SessionSettings settings)
    {
        RequireHashLength(newTokenHash, nameof(newTokenHash));
        if (presented.SessionId != Id)
        {
            throw new ArgumentException("The token belongs to another session.", nameof(presented));
        }

        presented.Consume(now);
        LastActiveAt = now;
        return new RotationResult(RotationOutcome.Rotated, RefreshToken.Issue(Id, presented.Id, newTokenHash, now));
    }

    private static void RequireHashLength(ReadOnlySpan<byte> hash, string paramName)
    {
        if (hash.Length != TokenHash.HashLength)
        {
            throw new ArgumentException($"A token hash must be {TokenHash.HashLength} bytes.", paramName);
        }
    }
}
