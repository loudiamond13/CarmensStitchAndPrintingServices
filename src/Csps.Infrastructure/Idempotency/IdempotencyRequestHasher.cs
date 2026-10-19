using System.Security.Cryptography;
using Csps.Infrastructure.Identity;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Idempotency;

/// <summary>Builds the hash stored with an idempotency record.</summary>
/// <param name="options">The sign-in secrets.</param>
public sealed class IdempotencyRequestHasher(IOptions<AuthSecretsOptions> options)
{
    /// <summary>The purpose label mixed into the derived key.</summary>
    public const string PurposeLabel = "csps/idempotency/request-hash/v1";

    /// <summary>Starts a hash.</summary>
    /// <returns>An incremental hash to append the request to.</returns>
    public IncrementalHash Create()
    {
        ArgumentNullException.ThrowIfNull(options);
        return IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
    }
}
