using System.Security.Cryptography;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Microsoft.AspNetCore.WebUtilities;

namespace Csps.Infrastructure.Identity;

/// <summary>Codes and tokens from <see cref="RandomNumberGenerator"/> only; <c>System.Random</c> is never used (CWE-330/338).</summary>
internal sealed class SecureRandom : ISecureRandom
{
    private const int TokenBytes = 32;

    public string NewSixDigitCode() => SixDigitCode.Format(RandomNumberGenerator.GetInt32(0, 1_000_000));

    public string NewToken() => WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(TokenBytes));
}
