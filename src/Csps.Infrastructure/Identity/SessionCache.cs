using System.ComponentModel;
using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Hybrid;

namespace Csps.Infrastructure.Identity;

/// <summary>
/// <see cref="ISessionCache"/> over the in-process HybridCache (AUTH-06). An answer lives for 60 seconds, or until
/// revocation evicts it, so a sign-out is refused on the very next request. The cache factory creates its own
/// context, because it can outlive the request that started it.
/// </summary>
internal sealed class SessionCache(HybridCache cache, IDbContextFactory<CspsDbContext> contextFactory, TimeProvider time) : ISessionCache
{
    private static readonly HybridCacheEntryOptions EntryOptions = new()
    {
        Expiration = TimeSpan.FromSeconds(60),
        LocalCacheExpiration = TimeSpan.FromSeconds(60),
    };

    public async ValueTask<bool> IsActiveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken)
    {
        var state = await cache.GetOrCreateAsync(
            SessionKey(sessionId), (contextFactory, sessionId), LoadAsync, EntryOptions, [UserTag(userId)], cancellationToken).ConfigureAwait(false);

        if (state.ExpiresAt is not { } expiresAt)
        {
            return false;
        }

        if (state.UserId != userId)
        {
            // The entry was tagged with this caller's user id, not its owner's: drop it so eviction by user stays exact.
            await cache.RemoveAsync(SessionKey(sessionId), cancellationToken).ConfigureAwait(false);
            return false;
        }

        return time.GetUtcNow() < expiresAt;
    }

    public ValueTask EvictAsync(Guid sessionId, CancellationToken cancellationToken) =>
        cache.RemoveAsync(SessionKey(sessionId), cancellationToken);

    public ValueTask EvictUserAsync(Guid userId, CancellationToken cancellationToken) =>
        cache.RemoveByTagAsync(UserTag(userId), cancellationToken);

    private static string SessionKey(Guid sessionId) => $"csps:session:{sessionId:N}";

    private static string UserTag(Guid userId) => $"csps:user:{userId:N}";

    // Unknown and revoked sessions are cached too (no end time), so a replayed dead token costs one query a minute.
    private static async ValueTask<SessionState> LoadAsync(
        (IDbContextFactory<CspsDbContext> Factory, Guid SessionId) state, CancellationToken cancellationToken)
    {
        var db = await state.Factory.CreateDbContextAsync(cancellationToken).ConfigureAwait(false);
        await using (db.ConfigureAwait(false))
        {
            var row = await db.UserSessions
                .AsNoTracking()
                .Where(session => session.Id == state.SessionId)
                .Select(session => new { session.UserId, session.RevokedAt, session.AbsoluteExpiresAt })
                .SingleOrDefaultAsync(cancellationToken)
                .ConfigureAwait(false);

            return row is null || row.RevokedAt is not null
                ? new SessionState(Guid.Empty, null)
                : new SessionState(row.UserId, row.AbsoluteExpiresAt);
        }
    }

    /// <summary>What the cache remembers of a session: its owner and when it ends, or no end time when it is not usable.</summary>
    [ImmutableObject(true)]
    private sealed record SessionState(Guid UserId, DateTimeOffset? ExpiresAt);
}
