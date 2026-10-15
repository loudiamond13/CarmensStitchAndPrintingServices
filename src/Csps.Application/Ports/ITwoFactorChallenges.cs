using Csps.Domain.Identity;

namespace Csps.Application.Ports;

/// <summary>
/// Stores pending sign-ins and their emailed codes (AUTH-02, AUTH-03, AUTH-04). Changes are saved by
/// <see cref="IUnitOfWork"/>, which also guards a challenge against two verifications at once with its row version.
/// </summary>
public interface ITwoFactorChallenges
{
    /// <summary>Tracks a new challenge, with any codes it holds, to be saved.</summary>
    /// <param name="challenge">The challenge to store.</param>
    void Add(TwoFactorChallenge challenge);

    /// <summary>Finds a challenge by the SHA-256 of its ticket, with its codes.</summary>
    /// <param name="ticketHash">The 32-byte hash of the ticket.</param>
    /// <param name="cancellationToken">Cancels the lookup.</param>
    /// <returns>The tracked challenge, or null when no challenge has that ticket.</returns>
    Task<TwoFactorChallenge?> FindByTicketHashAsync(byte[] ticketHash, CancellationToken cancellationToken);
}
