using System.Text.RegularExpressions;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>Names of the throwaway trial database and the guard that decides which database the tool may create or drop.</summary>
internal static partial class TrialDatabaseName
{
    public const string Prefix = "CSPS_Test_";

    private const int GuidLength = 36;

    /// <summary>Returns a fresh name: the prefix plus a lowercase D-format GUID.</summary>
    public static string NewName() => Prefix + Guid.NewGuid().ToString("D");

    /// <summary>True only for names matching <c>^CSPS_Test_[0-9a-f-]{36}$</c> exactly.</summary>
    public static bool IsDisposable(string? name) =>
        name is not null
        && name.Length == Prefix.Length + GuidLength
        && DisposablePattern().IsMatch(name);

    [GeneratedRegex("^CSPS_Test_[0-9a-f-]{36}$", RegexOptions.CultureInvariant)]
    private static partial Regex DisposablePattern();
}
