using System.Security.Cryptography;
using System.Text;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Identity;

/// <summary>
/// HMAC-SHA256 over the challenge id, the user id and the six ASCII digits, keyed by <c>Auth:CodeMacKey</c> (AUTH-03).
/// The input layout is the stored format: changing it invalidates every open challenge.
/// </summary>
internal sealed class HmacCodeMac(IOptions<AuthSecretsOptions> options) : ICodeMac
{
    private const int GuidBytes = 16;

    // Derived once; a missing or short key stops the host at start, so this only runs with a valid key.
    private readonly Lazy<byte[]> _key = new(() => options.Value.TryGetCodeMacKeyBytes(out var key)
        ? key
        : throw new InvalidOperationException(AuthSecretsOptions.CodeMacKeyInvalidMessage));

    public byte[] Compute(Guid challengeId, Guid userId, string code)
    {
        if (!SixDigitCode.IsWellFormed(code))
        {
            throw new ArgumentException("The code must be exactly six digits.", nameof(code));
        }

        Span<byte> input = stackalloc byte[(2 * GuidBytes) + SixDigitCode.Length];
        challengeId.TryWriteBytes(input[..GuidBytes], bigEndian: true, out _);
        userId.TryWriteBytes(input.Slice(GuidBytes, GuidBytes), bigEndian: true, out _);
        Encoding.ASCII.GetBytes(code, input[(2 * GuidBytes)..]);
        return HMACSHA256.HashData(_key.Value, input);
    }
}
