using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="ITwoFactorChallenges"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class TwoFactorChallengeStore(CspsDbContext context) : ITwoFactorChallenges
{
    public void Add(TwoFactorChallenge challenge)
    {
        ArgumentNullException.ThrowIfNull(challenge);
        context.TwoFactorChallenges.Add(challenge);
    }

    // The codes are ordered because the domain reads the newest code as the last one.
    public Task<TwoFactorChallenge?> FindByTicketHashAsync(byte[] ticketHash, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(ticketHash);
        return context.TwoFactorChallenges
            .Include(challenge => challenge.Codes.OrderBy(code => code.IssuedAt).ThenBy(code => code.Id))
            .FirstOrDefaultAsync(challenge => challenge.TicketHash == ticketHash, cancellationToken);
    }
}
