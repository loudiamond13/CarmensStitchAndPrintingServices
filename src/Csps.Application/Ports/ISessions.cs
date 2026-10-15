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
}
