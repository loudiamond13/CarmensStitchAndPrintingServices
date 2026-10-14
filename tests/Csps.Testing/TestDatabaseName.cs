using System.Text.RegularExpressions;

namespace Csps.Testing;

/// <summary>
/// Names of throwaway test databases and the guard that decides which databases test code may drop
/// (CLAUDE.md, D-05). Only <c>^CSPS_Test_[0-9a-f-]{36}$</c> is disposable: never <c>CSPS_Dev</c>,
/// <c>CSPS_E2E</c>, <c>CSPS_Legacy_Restore</c>, nor any other project's database such as <c>BetsLLC_*</c>.
/// </summary>
public static partial class TestDatabaseName
{
    /// <summary>The fixed prefix of every test database.</summary>
    public const string Prefix = "CSPS_Test_";

    private const int GuidLength = 36;

    /// <summary>Returns a fresh name, <c>CSPS_Test_</c> plus a lowercase D-format GUID.</summary>
    /// <returns>A name that <see cref="IsDisposable"/> accepts.</returns>
    public static string NewName() => Prefix + Guid.NewGuid().ToString("D");

    /// <summary>True only for names matching <c>^CSPS_Test_[0-9a-f-]{36}$</c> exactly (case-sensitive).</summary>
    /// <param name="name">A database name.</param>
    /// <returns>Whether test code may drop a database with this name.</returns>
    /// <remarks>.NET's <c>$</c> also matches before a final newline, so the exact length is checked as well.</remarks>
    public static bool IsDisposable(string? name) =>
        name is not null
        && name.Length == Prefix.Length + GuidLength
        && DisposablePattern().IsMatch(name);

    [GeneratedRegex("^CSPS_Test_[0-9a-f-]{36}$", RegexOptions.CultureInvariant)]
    private static partial Regex DisposablePattern();
}
