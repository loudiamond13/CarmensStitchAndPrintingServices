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
}
