using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace Csps.Testing;

/// <summary>
/// The JWT settings every test host validates against. Test-only and not a secret: the keys are derived in-process
/// from fixed labels, so they are the same on every run and no key material is written into the repository.
/// Production keys come only from host settings, development keys only from user-secrets.
/// </summary>
public static class TestJwt
{
    /// <summary>The token issuer the test host expects.</summary>
    public const string Issuer = "csps-tests";

    /// <summary>The token audience the test host expects.</summary>
    public const string Audience = "csps-tests-api";

    /// <summary>The configuration key of the issuer.</summary>
    public const string IssuerSetting = "Jwt:Issuer";

    /// <summary>The configuration key of the audience.</summary>
    public const string AudienceSetting = "Jwt:Audience";

    /// <summary>The configuration key of the base64 signing key.</summary>
    public const string SigningKeySetting = "Jwt:SigningKey";

    // 48 bytes each (SHA-384), above the 32-byte minimum for HS256.
    private static readonly byte[] KeyBytes = SHA384.HashData(Encoding.UTF8.GetBytes("csps-tests/jwt-signing-key/v1"));

    private static readonly byte[] OtherKeyBytes = SHA384.HashData(Encoding.UTF8.GetBytes("csps-tests/jwt-foreign-key/v1"));

    /// <summary>The test signing key as the base64 value the API reads from <see cref="SigningKeySetting"/>.</summary>
    public static string SigningKeyBase64 { get; } = Convert.ToBase64String(KeyBytes);

    /// <summary>Creates the key the test host trusts.</summary>
    /// <returns>A new key over a copy of the test key bytes.</returns>
    public static SymmetricSecurityKey SigningKey() => new((byte[])KeyBytes.Clone());

    /// <summary>Creates a different 48-byte key that the test host does not trust.</summary>
    /// <returns>A new key over a copy of the foreign key bytes.</returns>
    public static SymmetricSecurityKey OtherKey() => new((byte[])OtherKeyBytes.Clone());
}
