using System.Globalization;
using System.Text;

namespace Csps.LegacyFitCheck.Findings;

/// <summary>Writes the full findings list and the counts-only summary under the local folder only (D-01). The full list holds personal data and must never be committed.</summary>
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

        return await WriteFileAsync(localRoot, "findings", text.ToString(), time, cancellationToken).ConfigureAwait(false);
    }

    /// <summary>Writes the counts-only summary beside the full list and returns its repo-relative display path.</summary>
    public static Task<string> WriteSummaryAsync(string localRoot, string summary, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(summary);
        ArgumentNullException.ThrowIfNull(time);

        return WriteFileAsync(localRoot, "summary", summary, time, cancellationToken);
    }

    /// <summary>
    /// Works out the full path of an output file and refuses anything that is not inside the findings folder of the _local folder.
    /// Paths are made full first, and the inside test needs a trailing separator, so a sibling such as _localx never passes.
    /// </summary>
    internal static string ResolveTarget(string localRoot, string subFolder, string fileName)
    {
        var root = Path.TrimEndingDirectorySeparator(Path.GetFullPath(localRoot));
        if (!string.Equals(Path.GetFileName(root), LocalFolderName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException("The findings folder must be the _local folder.");
        }

        var folder = Path.TrimEndingDirectorySeparator(Path.GetFullPath(Path.Combine(root, subFolder)));
        var target = Path.GetFullPath(Path.Combine(folder, fileName));
        if (!IsInside(root, folder) || !IsInside(folder, target))
        {
            throw new InvalidOperationException("The findings file must sit inside the _local folder.");
        }

        return target;
    }

    private static async Task<string> WriteFileAsync(string localRoot, string prefix, string text, TimeProvider time, CancellationToken cancellationToken)
    {
        var stamp = time.GetUtcNow().ToString("yyyyMMdd-HHmmss", CultureInfo.InvariantCulture);
        var fileName = $"{prefix}-{stamp}.md";
        var target = ResolveTarget(localRoot, SubFolder, fileName);
        var folder = Path.GetDirectoryName(target)!;
        var root = Path.GetDirectoryName(folder)!;

        // A link is refused before anything is created, so nothing is ever written through one.
        RefuseLink(new DirectoryInfo(root));
        Directory.CreateDirectory(folder);
        RefuseLink(new DirectoryInfo(folder));
        var file = new FileInfo(target);
        RefuseLink(file);
        if (file.Exists)
        {
            throw new InvalidOperationException("An output file with this name already exists and is not overwritten.");
        }

        var stream = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        await using (stream.ConfigureAwait(false))
        {
            await stream.WriteAsync(new UTF8Encoding(encoderShouldEmitUTF8Identifier: false).GetBytes(text), cancellationToken).ConfigureAwait(false);
        }

        return $"{LocalFolderName}/{SubFolder}/{fileName}";
    }

    private static bool IsInside(string parent, string child) =>
        child.StartsWith(parent + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase);

    private static void RefuseLink(FileSystemInfo info)
    {
        if (info.LinkTarget is not null || (info.Exists && info.Attributes.HasFlag(FileAttributes.ReparsePoint)))
        {
            throw new InvalidOperationException("The _local folder, its findings folder and the output files must not be links.");
        }
    }

    private static string Cell(string? value) =>
        value is null
            ? string.Empty
            : value.Replace("|", "\\|", StringComparison.Ordinal).Replace("\r", " ", StringComparison.Ordinal).Replace("\n", " ", StringComparison.Ordinal);
}
