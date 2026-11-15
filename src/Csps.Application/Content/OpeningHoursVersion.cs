using Csps.Application.Common;
using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>
/// The version of the whole week (SEC-07): the seven row versions in day order, joined and written as base64. A save sends back the text
/// it was opened with, so a change to any one day makes every older copy stale. Any other text is not a version.
/// </summary>
public static class OpeningHoursVersion
{
    /// <summary>The number of bytes in a week version.</summary>
    public const int Length = OpeningHours.DayCount * RowVersions.Length;

    /// <summary>Writes the week version.</summary>
    /// <param name="rowVersions">The seven row versions, Monday first.</param>
    /// <returns>The base64 text.</returns>
    public static string ToText(IReadOnlyList<byte[]> rowVersions)
    {
        ArgumentNullException.ThrowIfNull(rowVersions);
        return Convert.ToBase64String([.. rowVersions.SelectMany(static version => version)]);
    }

    /// <summary>Reads a week version.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="version">The 56 bytes when the text is well formed; empty otherwise.</param>
    /// <returns>True only when the text is base64 that decodes to exactly seven row versions.</returns>
    public static bool TryParse(string? text, out byte[] version)
    {
        version = [];
        if (string.IsNullOrWhiteSpace(text))
        {
            return false;
        }

        Span<byte> buffer = stackalloc byte[Length];
        if (!Convert.TryFromBase64String(text, buffer, out var written) || written != Length)
        {
            return false;
        }

        version = buffer.ToArray();
        return true;
    }
}
