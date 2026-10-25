using Csps.Application.Profile;

namespace Csps.Application.Common;

/// <summary>
/// The text form of a SQL Server row version (SEC-07): standard base64 of exactly eight bytes. A form sends back the text it
/// was opened with, and any other text is not a version.
/// </summary>
public static class RowVersions
{
    /// <summary>The number of bytes in a SQL Server <c>rowversion</c>.</summary>
    public const int Length = 8;

    /// <summary>The message for a missing or malformed version, the same words the profile form uses.</summary>
    public const string InvalidMessage = UpdateProfileNameRequestValidator.VersionInvalid;

    /// <summary>Writes a row version as text.</summary>
    /// <param name="rowVersion">The eight bytes.</param>
    /// <returns>The base64 text.</returns>
    public static string ToText(byte[] rowVersion)
    {
        ArgumentNullException.ThrowIfNull(rowVersion);
        return Convert.ToBase64String(rowVersion);
    }

    /// <summary>Reads a row version from text.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="rowVersion">The eight bytes when the text is well formed; empty otherwise.</param>
    /// <returns>True only when the text is base64 that decodes to exactly eight bytes.</returns>
    public static bool TryParse(string? text, out byte[] rowVersion)
    {
        rowVersion = [];
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        Span<byte> buffer = stackalloc byte[Length];
        if (!Convert.TryFromBase64String(text, buffer, out var written) || written != Length)
        {
            return false;
        }

        rowVersion = buffer.ToArray();
        return true;
    }
}
