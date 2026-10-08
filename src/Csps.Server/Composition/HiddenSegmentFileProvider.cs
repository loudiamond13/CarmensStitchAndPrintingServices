using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Primitives;

namespace Csps.Server.Composition;

/// <summary>
/// Wraps the web-root file provider so build internals are never served (G-02-2, WEB-01): any path with a segment
/// that starts with a dot or contains a tilde reads as a missing file (CWE-200, CWE-538, CWE-497).
/// </summary>
/// <remarks>
/// <para>
/// The framework's <c>ExclusionFilters.Sensitive</c> checks only the leaf name, so a normal file inside a dot folder,
/// such as Vite's <c>.vite/license.md</c>, is otherwise served. Windows treats <c>\</c> as a path separator and NTFS
/// 8.3 short names alias <c>.vite</c> as <c>VITE~1</c>, so the rule splits on both separators and refuses any segment
/// with a tilde (CWE-41, CWE-58).
/// </para>
/// <para>
/// A hidden file reads as missing, so <c>StaticFileMiddleware</c> calls the next middleware and routing picks the
/// anonymous missing-file fallback (<see cref="Csps.Server.Endpoints.SpaHosting.FilePattern"/>): the same ProblemDetails
/// 404 as a file that does not exist. Vite and Rolldown asset names (<c>[name]-[hash]</c>) never start with a dot or
/// contain a tilde. A deliberate <c>/.well-known/</c> file later needs an explicit, tested exact-path exception here,
/// never a relaxed rule.
/// </para>
/// </remarks>
public sealed class HiddenSegmentFileProvider : IFileProvider
{
    private static readonly char[] Separators = ['/', '\\'];

    private readonly IFileProvider _inner;

    /// <summary>Creates the wrapper.</summary>
    /// <param name="inner">The web-root file provider to protect.</param>
    public HiddenSegmentFileProvider(IFileProvider inner)
    {
        ArgumentNullException.ThrowIfNull(inner);
        _inner = inner;
    }

    /// <summary>
    /// Whether a subpath must never be served: any segment, split on <c>/</c> and <c>\</c>, starts with a dot (which
    /// also covers <c>.</c> and <c>..</c>) or contains a tilde. A null or empty subpath is not hidden.
    /// </summary>
    /// <param name="subpath">The requested path relative to the web root.</param>
    /// <returns><see langword="true"/> when the path is refused.</returns>
    public static bool IsHidden(string? subpath)
    {
        if (string.IsNullOrEmpty(subpath))
        {
            return false;
        }

        foreach (var segment in subpath.Split(Separators, StringSplitOptions.RemoveEmptyEntries))
        {
            if (segment[0] == '.' || segment.Contains('~', StringComparison.Ordinal))
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>Returns a missing file for a hidden subpath without asking the inner provider; otherwise its file.</summary>
    /// <param name="subpath">The requested path relative to the web root.</param>
    /// <returns>The file information.</returns>
    public IFileInfo GetFileInfo(string subpath) =>
        IsHidden(subpath) ? new NotFoundFileInfo(subpath) : _inner.GetFileInfo(subpath);

    /// <summary>
    /// Returns a missing directory for a hidden subpath without asking the inner provider. A visible directory lists
    /// only the inner entries whose names are not hidden by the same rule, so a listing never shows a dot folder.
    /// </summary>
    /// <param name="subpath">The requested directory relative to the web root.</param>
    /// <returns>The directory contents.</returns>
    public IDirectoryContents GetDirectoryContents(string subpath)
    {
        if (IsHidden(subpath))
        {
            return NotFoundDirectoryContents.Singleton;
        }

        var contents = _inner.GetDirectoryContents(subpath);
        return contents.Exists ? new VisibleDirectoryContents(contents) : contents;
    }

    /// <summary>
    /// Returns the inner provider's change token unchanged: a token only signals that something changed and discloses
    /// no file content, so it needs no filtering.
    /// </summary>
    /// <param name="filter">The file or folder filter.</param>
    /// <returns>The change token.</returns>
    public IChangeToken Watch(string filter) => _inner.Watch(filter);

    /// <summary>An existing directory listing without the entries <see cref="IsHidden"/> refuses.</summary>
    private sealed class VisibleDirectoryContents(IDirectoryContents inner) : IDirectoryContents
    {
        public bool Exists => true;

        public IEnumerator<IFileInfo> GetEnumerator() =>
            inner.Where(static entry => !IsHidden(entry.Name)).GetEnumerator();

        System.Collections.IEnumerator System.Collections.IEnumerable.GetEnumerator() => GetEnumerator();
    }
}
