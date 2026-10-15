using System.Data;
using System.Globalization;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IAccountTokens"/> over the request's scoped <see cref="CspsDbContext"/>.</summary>
/// <param name="context">The scoped database context.</param>
internal sealed class AccountTokenStore(CspsDbContext context) : IAccountTokens
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

    // A transaction-owned application lock per account: the second request waits for the first to commit, so it
    // sees the first request's link and revokes it. Waits at most 10 seconds, then the request fails.
    public async Task LockAccountAsync(Guid userId, CancellationToken cancellationToken)
    {
        var resource = "csps-account-token:" + userId.ToString("N", CultureInfo.InvariantCulture);
        var outcome = new SqlParameter("@result", SqlDbType.Int) { Direction = ParameterDirection.Output };
        await context.Database.ExecuteSqlRawAsync(
            "EXEC @result = sp_getapplock @Resource = {0}, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 10000",
            [resource, outcome],
            cancellationToken).ConfigureAwait(false);

        // 0 and 1 mean the lock is held; a negative value is a timeout, a deadlock or an error.
        if (outcome.Value is not int code || code < 0)
        {
            throw new InvalidOperationException("The account link lock could not be taken.");
        }
    }

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
