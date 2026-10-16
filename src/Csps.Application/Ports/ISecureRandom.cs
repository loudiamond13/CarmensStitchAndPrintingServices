namespace Csps.Application.Ports;

/// <summary>The cryptographic random source for sign-in codes, tickets and tokens (AUTH-02, CWE-330/338).</summary>
public interface ISecureRandom
{
    /// <summary>Creates a code from 000000 to 999999, leading zeros kept.</summary>
    /// <returns>Six ASCII digits.</returns>
    string NewSixDigitCode();

    /// <summary>Creates a ticket or token from 32 random bytes.</summary>
    /// <returns>43 characters of base64url, without padding.</returns>
    string NewToken();
}
