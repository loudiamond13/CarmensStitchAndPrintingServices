using Csps.Domain.Identity;

namespace Csps.Application.Ports;

/// <summary>
/// Stores sign-in sessions and their refresh tokens (AUTH-05, D-43). Changes are saved by <see cref="IUnitOfWork"/>.
/// Only token hashes are stored.
/// </summary>
public interface ISessions
{
    /// <summary>Tracks a new session and its first refresh token, to be saved.</summary>
    /// <param name="session">The new session.</param>
    /// <param name="firstToken">The first refresh token, issued with the session.</param>
    void Add(UserSession session, RefreshToken firstToken);

    /// <summary>Finds a session by id.</summary>
    /// <param name="sessionId">The session id.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The tracked session, or null when none has that id.</returns>
    Task<UserSession?> FindAsync(Guid sessionId, CancellationToken cancellationToken);

    /// <summary>Lists a user's active sessions, most recently active first, without loading their tokens (D-43).</summary>
    /// <param name="userId">The account.</param>
    /// <param name="now">The current instant; revoked and expired sessions are left out.</param>
    /// <param name="cap">The most sessions to return.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>Read-only sessions, newest activity first; empty when there are none.</returns>
    Task<IReadOnlyList<UserSession>> ListActiveAsync(Guid userId, DateTimeOffset now, int cap, CancellationToken cancellationToken);

    /// <summary>Finds the refresh token with this hash, with its session and the tokens rotation needs.</summary>
    /// <param name="tokenHash">SHA-256 of the presented token.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The tracked session and tokens, or null when no token has that hash.</returns>
    Task<RefreshLookup?> FindByRefreshHashAsync(byte[] tokenHash, CancellationToken cancellationToken);

    /// <summary>Tracks a refresh token issued by a rotation, to be saved.</summary>
    /// <param name="token">The child token.</param>
    void AddToken(RefreshToken token);

    /// <summary>
    /// Revokes every active session of a user except one (D-05), with their open tokens, to be saved. The caller
    /// then evicts the user from <see cref="ISessionCache"/> so the revocation shows at once.
    /// </summary>
    /// <param name="userId">The account.</param>
    /// <param name="exceptSessionId">The session to keep; null revokes all.</param>
    /// <param name="reason">Why the sessions end.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="cancellationToken">Cancels the operation.</param>
    /// <returns>The ids of the sessions revoked; empty when there were none.</returns>
    Task<IReadOnlyList<Guid>> RevokeAllAsync(
        Guid userId,
        Guid? exceptSessionId,
        SessionRevocationReason reason,
        DateTimeOffset now,
        CancellationToken cancellationToken);
}

/// <summary>A presented refresh token with what <see cref="UserSession.Rotate"/> needs (AUTH-05).</summary>
/// <param name="Session">The token's session.</param>
/// <param name="Presented">The token that was presented.</param>
/// <param name="Related">
/// The presented token, the session's unused and unrevoked tokens, and the presented token's children; not the
/// session's whole history.
/// </param>
public sealed record RefreshLookup(UserSession Session, RefreshToken Presented, IReadOnlyList<RefreshToken> Related);
