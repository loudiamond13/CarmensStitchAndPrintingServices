using System.Security.Cryptography;
using System.Text;

namespace Csps.Testing;

/// <summary>
/// Test-only sign-in secrets. Not a secret: the key is derived in-process from a fixed label (the <see cref="TestJwt"/>
/// pattern), so it is the same on every run and no key material is written into the repository.
/// </summary>
public static class TestSecrets
{
    /// <summary>The configuration key of the code MAC key.</summary>
    public const string CodeMacKeySetting = "Auth:CodeMacKey";

    // 48 bytes (SHA-384), above the 32-byte minimum.
    private static readonly byte[] CodeMacKeyBytes = SHA384.HashData(Encoding.UTF8.GetBytes("csps-tests/code-mac-key/v1"));

    /// <summary>The test code MAC key as the base64 value the API reads from <see cref="CodeMacKeySetting"/>.</summary>
    public static string CodeMacKeyBase64 { get; } = Convert.ToBase64String(CodeMacKeyBytes);
}
