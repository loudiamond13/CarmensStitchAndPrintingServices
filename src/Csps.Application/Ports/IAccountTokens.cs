using Csps.Domain.Identity;

namespace Csps.Application.Ports;

/// <summary>
/// Stores the hashed link tokens of accounts (AUTH-08, D-28). Changes are saved by <see cref="IUnitOfWork"/>.
/// </summary>
public interface IAccountTokens
{
    /// <summary>Tracks a new token to be saved.</summary>
    /// <param name="token">The token to store.</param>
    void Add(AccountToken token);

    /// <summary>Finds a token by the SHA-256 of its value.</summary>
    /// <param name="hash">The 32-byte hash.</param>
    /// <param name="purpose">What the link is for.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The tracked token, or null when none matches.</returns>
    Task<AccountToken?> FindByHashAsync(byte[] hash, AccountTokenPurpose purpose, CancellationToken cancellationToken);

    /// <summary>
    /// Waits for the account's link lock, held until the surrounding transaction ends, so two requests for the same
    /// account run one after the other. Call it inside <see cref="IUnitOfWork.InTransactionAsync{T}"/>.
    /// </summary>
    /// <param name="userId">The account.</param>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the lock is held.</returns>
    Task LockAccountAsync(Guid userId, CancellationToken cancellationToken);

    /// <summary>Revokes every unused, unrevoked token of the account for a purpose. The change is saved with the caller's unit of work.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="purpose">What the links are for.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="cancellationToken">Cancels the load.</param>
    /// <returns>How many tokens were revoked.</returns>
    Task<int> RevokeOpenAsync(Guid userId, AccountTokenPurpose purpose, DateTimeOffset now, CancellationToken cancellationToken);
}
