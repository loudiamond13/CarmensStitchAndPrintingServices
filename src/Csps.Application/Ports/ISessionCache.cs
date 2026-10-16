namespace Csps.Application.Ports;

/// <summary>
/// The per-request check that a token's session is still active (AUTH-06). Answers are cached for 60 seconds in
/// process; revocation evicts them so the very next request is refused.
/// </summary>
public interface ISessionCache
{
    /// <summary>Whether the session exists, belongs to the user, is not revoked and has not reached its end.</summary>
    /// <param name="sessionId">The session id from the token.</param>
    /// <param name="userId">The user id from the token.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>True when the request may go on.</returns>
    ValueTask<bool> IsActiveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken);

    /// <summary>Forgets what is cached for one session. Call after revoking it.</summary>
    /// <param name="sessionId">The session id.</param>
    /// <param name="cancellationToken">Cancels the eviction.</param>
    /// <returns>A task that completes when the entry is gone.</returns>
    ValueTask EvictAsync(Guid sessionId, CancellationToken cancellationToken);

    /// <summary>Forgets what is cached for every session of one user. Call after revoking several at once.</summary>
    /// <param name="userId">The user id.</param>
    /// <param name="cancellationToken">Cancels the eviction.</param>
    /// <returns>A task that completes when the entries are gone.</returns>
    ValueTask EvictUserAsync(Guid userId, CancellationToken cancellationToken);
}
