namespace Csps.Application.Ports;

/// <summary>
/// The local list of the 10,000 most common passwords (D-14). It is the floor when the breach service is down: a
/// password on it is refused, whatever the service would have said.
/// </summary>
public interface ICommonPasswords
{
    /// <summary>Tells whether a password is on the list, ignoring letter case.</summary>
    /// <param name="password">The password, NFC-normalized by the caller.</param>
    /// <returns>True when the password is common.</returns>
    bool IsCommon(string password);
}
