namespace Csps.Application.Ports;

/// <summary>
/// Clears the public site's cached data (PUB-03, CONT-05). The data layer calls it after any committed save of a public record. Code
/// that writes with <c>ExecuteUpdate</c> or <c>ExecuteDelete</c> skips the save interceptors and must call it itself.
/// </summary>
public interface IPublicContentCache
{
    /// <summary>
    /// Discards every public snapshot and shaped page, and the site settings the business calendar reads, so the next read goes to the
    /// database and sees the committed values.
    /// </summary>
    /// <param name="cancellationToken">Cancels the invalidation.</param>
    /// <returns>A task that completes when the entries are invalid.</returns>
    ValueTask InvalidateAsync(CancellationToken cancellationToken);
}
