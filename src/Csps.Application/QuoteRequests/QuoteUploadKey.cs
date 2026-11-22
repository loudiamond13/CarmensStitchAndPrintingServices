using System.Buffers.Text;
using System.Security.Cryptography;
using Csps.Domain.QuoteRequests;

namespace Csps.Application.QuoteRequests;

/// <summary>
/// The upload key of a quote request (INQ-02, CWE-639). The browser makes 32 random bytes and writes them as base64url text; the
/// server keeps only the SHA-256, so a copy of the database cannot upload a photo.
/// </summary>
public static class QuoteUploadKey
{
    /// <summary>Reads a key and hashes it.</summary>
    /// <param name="key">The key text as sent.</param>
    /// <param name="hash">The SHA-256 of the key bytes when the text is a key.</param>
    /// <returns>True when the text is base64url of exactly 32 bytes.</returns>
    public static bool TryHash(string? key, out byte[] hash)
    {
        hash = [];
        if (string.IsNullOrEmpty(key))
        {
            return false;
        }

        // IsValid also gives the decoded length, so a bad character or a wrong size is refused before any decoding (decoding throws on a bad character).
        if (!Base64Url.IsValid(key, out var length) || length != QuoteRequestRules.UploadKeyBytes)
        {
            return false;
        }

        hash = SHA256.HashData(Base64Url.DecodeFromChars(key));
        return true;
    }
}
