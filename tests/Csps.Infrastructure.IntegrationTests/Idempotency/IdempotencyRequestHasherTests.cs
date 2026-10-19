using System.Security.Cryptography;
using System.Text;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Idempotency;
using Csps.Testing;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.IntegrationTests.Idempotency;

/// <summary>
/// SEC-06, D-50: the stored request hash is an HMAC-SHA256 under a key derived from the code key for this purpose
/// only, so a copy of the table cannot be used to test password guesses. Nothing here opens a database.
/// </summary>
public sealed class IdempotencyRequestHasherTests
{
    private static readonly byte[] Input = Encoding.UTF8.GetBytes("target and body");

    [Fact]
    public void TheHashIs32BytesAndDeterministic()
    {
        var hasher = NewHasher(TestSecrets.CodeMacKeyBase64);

        var first = Hash(hasher, Input);

        first.Length.ShouldBe(32);
        Hash(hasher, Input).ShouldBe(first);
    }

    [Fact]
    public void AnotherValidKeyGivesAnotherHash()
    {
        var other = Convert.ToBase64String(SHA384.HashData(Encoding.UTF8.GetBytes("another key")));

        Hash(NewHasher(other), Input).ShouldNotBe(Hash(NewHasher(TestSecrets.CodeMacKeyBase64), Input));
    }

    [Fact]
    public void TheHashIsHmacSha256UnderAnHkdfKeyForThePurposeLabel()
    {
        var codeKey = Convert.FromBase64String(TestSecrets.CodeMacKeyBase64);
        var derived = HKDF.DeriveKey(HashAlgorithmName.SHA256, codeKey, 32, salt: [], info: Encoding.UTF8.GetBytes("csps/idempotency/request-hash/v1"));

        Hash(NewHasher(TestSecrets.CodeMacKeyBase64), Input).ShouldBe(HMACSHA256.HashData(derived, Input));
    }

    [Fact]
    public void TheHashIsNeverKeyedWithTheRawCodeKey()
    {
        var codeKey = Convert.FromBase64String(TestSecrets.CodeMacKeyBase64);

        Hash(NewHasher(TestSecrets.CodeMacKeyBase64), Input).ShouldNotBe(HMACSHA256.HashData(codeKey, Input));
    }

    [Fact]
    public void TheHashIsNotThePlainSha256()
    {
        Hash(NewHasher(TestSecrets.CodeMacKeyBase64), Input).ShouldNotBe(SHA256.HashData(Input));
    }

    [Fact]
    public void AnInvalidKeyFailsWithTheSettingNameAndNotTheValue()
    {
        const string Value = "short-key";
        var hasher = NewHasher(Value);

        var failure = Should.Throw<InvalidOperationException>(() => hasher.Create());

        failure.Message.ShouldBe(AuthSecretsOptions.CodeMacKeyInvalidMessage);
        failure.Message.ShouldNotContain(Value);
    }

    private static byte[] Hash(IdempotencyRequestHasher hasher, byte[] input)
    {
        using var hash = hasher.Create();
        hash.AppendData(input);
        return hash.GetHashAndReset();
    }

    private static IdempotencyRequestHasher NewHasher(string key) => new(Options.Create(new AuthSecretsOptions { CodeMacKey = key }));
}
