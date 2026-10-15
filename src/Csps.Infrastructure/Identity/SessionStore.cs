using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="ISessions"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class SessionStore(CspsDbContext context) : ISessions
{
    public void Add(UserSession session, RefreshToken firstToken)
    {
        ArgumentNullException.ThrowIfNull(session);
        ArgumentNullException.ThrowIfNull(firstToken);
        context.UserSessions.Add(session);
        context.RefreshTokens.Add(firstToken);
    }

    public Task<UserSession?> FindAsync(Guid sessionId, CancellationToken cancellationToken) =>
        context.UserSessions.FirstOrDefaultAsync(session => session.Id == sessionId, cancellationToken);

    public async Task<RefreshLookup?> FindByRefreshHashAsync(byte[] tokenHash, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(tokenHash);
        var presented = await context.RefreshTokens
            .FirstOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken)
            .ConfigureAwait(false);
        if (presented is null)
        {
            return null;
        }

        var session = await context.UserSessions
            .FirstAsync(candidate => candidate.Id == presented.SessionId, cancellationToken)
            .ConfigureAwait(false);
        var presentedId = presented.Id;
        var related = await context.RefreshTokens
            .Where(token => token.SessionId == session.Id
                && ((token.ConsumedAt == null && token.RevokedAt == null) || token.ParentId == presentedId))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        if (!related.Contains(presented))
        {
            related.Add(presented);
        }

        return new RefreshLookup(session, presented, related);
    }

    public void AddToken(RefreshToken token)
    {
        ArgumentNullException.ThrowIfNull(token);
        context.RefreshTokens.Add(token);
    }

    public async Task<IReadOnlyList<Guid>> RevokeAllAsync(
        Guid userId,
        Guid? exceptSessionId,
        SessionRevocationReason reason,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var open = await context.UserSessions
            .Where(session => session.UserId == userId && session.RevokedAt == null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var targets = UserSession.SelectOthersToRevoke(open, exceptSessionId ?? Guid.Empty, now);
        if (targets.Count == 0)
        {
            return [];
        }

        var ids = targets.Select(session => session.Id).ToList();
        var tokens = await context.RefreshTokens
            .Where(token => ids.Contains(token.SessionId) && token.ConsumedAt == null && token.RevokedAt == null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        foreach (var session in targets)
        {
            session.Revoke(reason, now, [.. tokens.Where(token => token.SessionId == session.Id)]);
        }

        return ids;
    }
}
