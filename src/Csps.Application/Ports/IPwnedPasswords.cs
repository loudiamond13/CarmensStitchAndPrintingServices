namespace Csps.Application.Ports;

/// <summary>What the breached-password service said about a password.</summary>
public enum BreachCheckResult
{
    /// <summary>The service answered and the password is not in a known breach.</summary>
    NotBreached,

    /// <summary>The password appears in a known breach.</summary>
    Breached,

    /// <summary>The service did not give a usable answer (down, slow or malformed).</summary>
    Unavailable,
}

/// <summary>
/// Asks whether a password has appeared in a data breach (AUTH-11, D-12). Only the first five characters of the
/// password's SHA-1 may leave the app (k-anonymity), and the password and its hash are never logged or stored.
/// </summary>
public interface IPwnedPasswords
{
    /// <summary>Checks one password.</summary>
    /// <param name="password">The password; it is NFC-normalized before it is hashed.</param>
    /// <param name="cancellationToken">Cancels the check; a cancelled call throws instead of answering Unavailable.</param>
    /// <returns>The answer; never throws for a service failure.</returns>
    Task<BreachCheckResult> CheckAsync(string password, CancellationToken cancellationToken);
}
