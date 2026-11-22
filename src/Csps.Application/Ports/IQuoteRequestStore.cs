using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>The tracked store of quote requests: new requests are added and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IQuoteRequestStore
{
    /// <summary>Adds a new request to the unit of work. Nothing is saved here.</summary>
    /// <param name="request">The new request.</param>
    void Add(QuoteRequest request);

    /// <summary>Finds a product line by its key, only while the line is shown on the public site (D-24).</summary>
    /// <param name="key">The line key, trimmed.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The line, or null when no shown line has the key.</returns>
    Task<QuoteProductLine?> FindShownLineAsync(string key, CancellationToken cancellationToken);
}
