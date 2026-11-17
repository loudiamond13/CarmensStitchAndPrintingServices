namespace Csps.Application.Ports;

/// <summary>Maps a path to the page key the counts use (ANL-05). The server's route table answers it, so the counts follow the pages the site really has.</summary>
public interface IPublicPageResolver
{
    /// <summary>Finds the page key for a path that is already cut at <c>?</c> and <c>#</c>.</summary>
    /// <param name="cutPath">The cut path, starting with a slash.</param>
    /// <returns>The page key (a known page, or <c>not-found</c> for any other public path); null for an admin or developer path, which is never counted.</returns>
    string? PageKeyFor(string cutPath);
}
