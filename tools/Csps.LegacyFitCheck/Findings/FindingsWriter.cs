using System.Globalization;
using System.Text;

namespace Csps.LegacyFitCheck.Findings;

/// <summary>Writes the full findings list under the local folder only (D-01). It holds personal data and must never be committed.</summary>
internal static class FindingsWriter
{
    private const string LocalFolderName = "_local";
    private const string SubFolder = "legacy-fit-check";

    /// <summary>Writes the findings file and returns its repo-relative display path.</summary>
    public static async Task<string> WriteAsync(
        string localRoot,
        IReadOnlyList<Finding> findings,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(findings);
        ArgumentNullException.ThrowIfNull(time);

        var root = Path.GetFullPath(localRoot);
        if (!string.Equals(Path.GetFileName(root), LocalFolderName, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The findings folder must be the _local folder.");
        }

        var folder = Path.GetFullPath(Path.Combine(root, SubFolder));
        var stamp = time.GetUtcNow().ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        var fileName = $"findings-{stamp}.md";
        var target = Path.GetFullPath(Path.Combine(folder, fileName));
        if (!target.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("The findings file must sit inside the _local folder.");
        }

        Directory.CreateDirectory(folder);
        if (IsLink(root) || IsLink(folder))
        {
            throw new InvalidOperationException("The _local folder and its findings folder must not be links.");
        }

        var created = time.GetLocalNow().ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);
        var text = new StringBuilder()
            .Append("# Legacy fit check: full findings\n")
            .Append(CultureInfo.InvariantCulture, $"*Created: {created} · Updated: {created}*\n")
            .Append('\n')
            .Append("Holds personal data. Never commit, upload or deploy this file (07.1 D-01).\n")
            .Append('\n')
            .Append("| Record | Key | Type | Rule | Path | Message | List value | Detail |\n")
            .Append("|---|---|---|---|---|---|---|---|\n");
        foreach (var finding in findings)
        {
            text.Append(CultureInfo.InvariantCulture, $"| {finding.Kind} | {Cell(finding.LegacyKey)} | {finding.Type} | {Cell(finding.RuleKey)} | {Cell(finding.Path)} | {Cell(finding.Message)} | {Cell(finding.ListValue)} | {Cell(finding.Detail)} |\n");
        }

        await File.WriteAllTextAsync(target, text.ToString(), cancellationToken).ConfigureAwait(false);
        return $"{LocalFolderName}/{SubFolder}/{fileName}";
    }

    private static bool IsLink(string path) =>
        new DirectoryInfo(path).Attributes.HasFlag(FileAttributes.ReparsePoint);

    private static string Cell(string? value) =>
        value is null
            ? string.Empty
            : value.Replace("|", "\\|", StringComparison.Ordinal).Replace("\r", " ", StringComparison.Ordinal).Replace("\n", " ", StringComparison.Ordinal);
}
