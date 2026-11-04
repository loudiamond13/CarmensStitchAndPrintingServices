namespace Csps.Infrastructure.Images;

/// <summary>How Cloudinary answers map to storage outcomes (IMG-01, D-05).</summary>
internal static class CloudinaryResults
{
    /// <summary>The failure code of a busy, rate-limited or unreachable Cloudinary; trying again later can work.</summary>
    public const string TransientCode = "transient";

    /// <summary>The failure code of keys that Cloudinary does not accept; trying again will not help.</summary>
    public const string UnauthorizedCode = "unauthorized";
}
