using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IAccountTokens"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
/// <param name="time">The clock.</param>
internal sealed class AccountTokenStore(CspsDbContext context, TimeProvider time) : IAccountTokens
{
    public void Add(AccountToken token)
    {
        ArgumentNullException.ThrowIfNull(token);
        context.AccountTokens.Add(token);
    }

    public Task<AccountToken?> FindByHashAsync(byte[] hash, AccountTokenPurpose purpose, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(hash);
        return context.AccountTokens.FirstOrDefaultAsync(token => token.TokenHash == hash && token.Purpose == purpose, cancellationToken);
    }

    // The person's lock is one of 64 fixed lock rows chosen from their id, so the same person always takes turns and the second
    // request sees the first one's link. Two people on the same row also take turns, which costs at most one short request.
    public Task LockAccountAsync(Guid userId, CancellationToken cancellationToken) =>
        DatabaseLocks.TakeAsync(
            context,
            DatabaseLocks.AccountStripe(userId),
            time.GetUtcNow(),
            DatabaseLocks.DefaultWait,
            "The account link lock could not be taken.",
            cancellationToken);

    public async Task<int> RevokeOpenAsync(Guid userId, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var open = await context.AccountTokens
            .Where(token => token.UserId == userId && token.Purpose == purpose && token.UsedAt == null && token.RevokedAt == null)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        foreach (var token in open)
        {
            token.Revoke(now);
        }

        return open.Count;
    }
}
