using System.Security.Cryptography;
using System.Text;
using Csps.Infrastructure.Identity;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Idempotency;

/// <summary>
/// Builds the HMAC-SHA256 stored as <c>IdempotencyRecord.RequestHash</c> (SEC-06, D-50). The key is derived from
/// <c>Auth:CodeMacKey</c> with HKDF and <see cref="PurposeLabel"/>, so this hash never uses the raw sign-in code key and
/// the code MAC never uses this one. Request bodies can hold passwords, so a stored hash must not be testable offline.
/// The label and the input layout are the stored format: changing either, or rotating <c>Auth:CodeMacKey</c>, makes
/// records younger than 24 hours non-matching, so a retry gets 422 and never runs twice.
/// </summary>
/// <param name="options">The sign-in secrets.</param>
public sealed class IdempotencyRequestHasher(IOptions<AuthSecretsOptions> options)
{
    /// <summary>The purpose label mixed into the derived key.</summary>
    public const string PurposeLabel = "csps/idempotency/request-hash/v1";

    private const int KeyBytes = 32;

    // Derived once; a missing or short key stops the host at start, so this only runs with a valid key.
    private readonly Lazy<byte[]> _key = new(() => options.Value.TryGetCodeMacKeyBytes(out var codeKey)
        ? HKDF.DeriveKey(HashAlgorithmName.SHA256, codeKey, KeyBytes, salt: [], info: Encoding.UTF8.GetBytes(PurposeLabel))
        : throw new InvalidOperationException(AuthSecretsOptions.CodeMacKeyInvalidMessage));

    /// <summary>Starts a keyed hash.</summary>
    /// <returns>An incremental HMAC-SHA256 to append the request to. The caller disposes it.</returns>
    public IncrementalHash Create() => IncrementalHash.CreateHMAC(HashAlgorithmName.SHA256, _key.Value);
}
