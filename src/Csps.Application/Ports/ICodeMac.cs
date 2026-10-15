namespace Csps.Application.Ports;

/// <summary>
/// Binds an emailed sign-in code to its challenge and account (AUTH-03). The MAC is HMAC-SHA256 with the
/// <c>Auth:CodeMacKey</c> secret, so a copy of the database cannot be used to guess or forge a code.
/// </summary>
public interface ICodeMac
{
    /// <summary>Computes the 32-byte MAC of a code.</summary>
    /// <param name="challengeId">The sign-in challenge the code belongs to.</param>
    /// <param name="userId">The account signing in.</param>
    /// <param name="code">The six-digit code.</param>
    /// <returns>The MAC; the code itself is never stored.</returns>
    /// <exception cref="ArgumentException"><paramref name="code"/> is not exactly six digits.</exception>
    byte[] Compute(Guid challengeId, Guid userId, string code);
}
