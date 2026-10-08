using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Primitives;

namespace Csps.Server.Composition;

/// <summary>RED placeholder: delegates everything to the inner provider and hides nothing yet.</summary>
/// <param name="inner">The web-root file provider to protect.</param>
public sealed class HiddenSegmentFileProvider(IFileProvider inner) : IFileProvider
{
    /// <summary>RED placeholder: never hides anything.</summary>
    /// <param name="subpath">The requested path relative to the web root.</param>
    /// <returns>Always <see langword="false"/>.</returns>
    public static bool IsHidden(string? subpath) => subpath?.Length < 0;

    /// <inheritdoc />
    public IFileInfo GetFileInfo(string subpath) => inner.GetFileInfo(subpath);

    /// <inheritdoc />
    public IDirectoryContents GetDirectoryContents(string subpath) => inner.GetDirectoryContents(subpath);

    /// <inheritdoc />
    public IChangeToken Watch(string filter) => inner.Watch(filter);
}
