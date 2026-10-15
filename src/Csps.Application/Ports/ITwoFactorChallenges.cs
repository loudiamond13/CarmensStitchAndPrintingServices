using Csps.Domain.Identity;

namespace Csps.Application.Ports;

/// <summary>
/// Stores pending sign-ins and their emailed codes (AUTH-02, AUTH-03, AUTH-04). Changes are saved by
/// <see cref="IUnitOfWork"/>. A second save that changes a code or challenge another request already changed fails
/// with a concurrency conflict, so a code can never sign in twice.
/// </summary>
public interface ITwoFactorChallenges
{
    /// <summary>Tracks a new challenge, with any codes it holds, to be saved.</summary>
    /// <param name="challenge">The challenge to store.</param>
    void Add(TwoFactorChallenge challenge);

    /// <summary>Finds a challenge by the SHA-256 of its ticket, with its codes oldest first.</summary>
    /// <param name="ticketHash">The 32-byte hash of the ticket.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The tracked challenge, or null when no challenge has that ticket.</returns>
    Task<TwoFactorChallenge?> FindByTicketHashAsync(byte[] ticketHash, CancellationToken cancellationToken);

    /// <summary>Counts the codes issued to one account, across all its challenges, at or after <paramref name="since"/>.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="since">The start of the rolling window.</param>
    /// <param name="cancellationToken">Cancels the count.</param>
    /// <returns>The number of codes sent (the input of the hourly send cap).</returns>
    Task<int> CountCodesIssuedSinceAsync(Guid userId, DateTimeOffset since, CancellationToken cancellationToken);

    /// <summary>Sums the wrong tries on one account's codes issued at or after <paramref name="since"/>, across its challenges.</summary>
    /// <param name="userId">The account.</param>
    /// <param name="since">The start of the rolling window.</param>
    /// <param name="cancellationToken">Cancels the count.</param>
    /// <returns>The number of wrong codes (the input of the account failure cap).</returns>
    Task<int> CountFailedAttemptsSinceAsync(Guid userId, DateTimeOffset since, CancellationToken cancellationToken);

    /// <summary>
    /// Cancels every challenge of the account that is still waiting (pending or awaiting a new password), so at most
    /// one code works at a time. The change is saved with the caller's unit of work.
    /// </summary>
    /// <param name="userId">The account.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="cancellationToken">Cancels the load.</param>
    /// <returns>How many challenges were cancelled.</returns>
    Task<int> InvalidateOpenAsync(Guid userId, DateTimeOffset now, CancellationToken cancellationToken);
}
