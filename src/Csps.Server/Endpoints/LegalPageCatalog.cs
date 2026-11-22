using Csps.Domain.Content;

namespace Csps.Server.Endpoints;

/// <summary>
/// Tells the shell and the sitemap which legal pages are still drafts (LEGAL-05, D-14, T-12-10). A draft is sent with the noindex
/// robots meta and is left out of <c>sitemap.xml</c>. The real answer comes from <see cref="LegalPages"/>; tests replace it with
/// a fact set of their own, so approval can be proven without editing the real facts.
/// </summary>
public interface ILegalPageCatalog
{
    /// <summary>Tells whether a path is a legal page whose text the owner has not approved.</summary>
    /// <param name="path">The lower-case canonical path, such as <c>/terms</c>.</param>
    /// <returns>True for an unapproved legal page; false for an approved one and for any other path.</returns>
    bool IsDraft(string path);
}

/// <summary>The catalog over the facts in code.</summary>
internal sealed class LegalPageCatalog : ILegalPageCatalog
{
    public bool IsDraft(string path) => LegalPages.ByPath(path) is { Approved: false };
}
