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

    public Task<int> CountCodesIssuedSinceAsync(Guid userId, DateTimeOffset since, CancellationToken cancellationToken) =>
        CodesOf(userId).CountAsync(code => code.IssuedAt >= since, cancellationToken);

    public Task<int> CountFailedAttemptsSinceAsync(Guid userId, DateTimeOffset since, CancellationToken cancellationToken) =>
        CodesOf(userId).Where(code => code.IssuedAt >= since).SumAsync(code => code.FailedAttempts, cancellationToken);

    public async Task<int> InvalidateOpenAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var open = await context.TwoFactorChallenges
            .Where(challenge => challenge.UserId == userId
                && (challenge.Status == TwoFactorChallengeStatus.Pending || challenge.Status == TwoFactorChallengeStatus.AwaitingNewPassword))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        foreach (var challenge in open)
        {
            challenge.Invalidate(now);
        }

        return open.Count;
    }

    // Read-only and set-based: the user and challenge indexes back it, and no entity is tracked.
    private IQueryable<TwoFactorCode> CodesOf(Guid userId) =>
        context.TwoFactorChallenges.AsNoTracking()
            .Where(challenge => challenge.UserId == userId)
            .SelectMany(challenge => challenge.Codes);
}
