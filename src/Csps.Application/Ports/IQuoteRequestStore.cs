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

    /// <summary>Reads what an upload needs about a request, without tracking it.</summary>
    /// <param name="requestId">The request id from the route.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request's upload facts, or null when there is no such request.</returns>
    Task<QuotePhotoTarget?> FindForUploadAsync(Guid requestId, CancellationToken cancellationToken);

    /// <summary>
    /// Writes a stored photo into its place with one conditional update: the place must still be empty and the request must not be Spam.
    /// It never touches the request row, so two photos of one request can be saved at the same time.
    /// </summary>
    /// <param name="requestId">The request id.</param>
    /// <param name="slot">The place.</param>
    /// <param name="stored">The facts of the stored file.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>True when the place was filled; false when it was already filled or the request is Spam or gone.</returns>
    Task<bool> FillPhotoSlotAsync(Guid requestId, int slot, QuotePhotoStored stored, CancellationToken cancellationToken);
}
