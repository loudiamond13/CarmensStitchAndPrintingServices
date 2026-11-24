using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>The tracked store of quote requests: new requests are added and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IQuoteRequestStore
{
    /// <summary>Finds a request to change, tracked with its photo places, for the unit of work to save.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request, or null when there is no such request.</returns>
    Task<QuoteRequest?> FindAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>
    /// Takes the request's row lock for an order save (D-23): one conditional update that matches the id only while the request is not
    /// Converted. Call it inside <see cref="IUnitOfWork.InTransactionAsync{T}"/> before the order number is taken; a second save of
    /// the same request waits here and then matches nothing.
    /// </summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>True when the request exists, is not Converted and is now locked; false otherwise.</returns>
    /// <exception cref="Csps.Application.Common.ConcurrencyConflictException">The wait ran out of time or was a deadlock victim.</exception>
    Task<bool> LockForConversionAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Reads whether a request exists, its status and the order it became, with that order's number even when the order was deleted.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The state, or null when there is no such request.</returns>
    Task<QuoteConversionState?> FindConversionAsync(Guid id, CancellationToken cancellationToken);

    /// <summary>Finds the request an order was made from, tracked with its photo places, for the permanent order delete (D-22).</summary>
    /// <param name="orderId">The order id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The request, or null when the order was not made from one.</returns>
    Task<QuoteRequest?> FindByOrderAsync(Guid orderId, CancellationToken cancellationToken);

    /// <summary>Adds a new request to the unit of work. Nothing is saved here.</summary>
    /// <param name="request">The new request.</param>
    void Add(QuoteRequest request);

    /// <summary>Marks a found request for removal; the save removes it with its photo places, notes and history (D-16).</summary>
    /// <param name="request">The tracked request.</param>
    void Remove(QuoteRequest request);

    /// <summary>
    /// Takes the standing <c>quote-requests</c> lock for the current transaction, so the per-sender count and the insert of a request
    /// cannot run at the same time as another send (D-37). Call it first inside <see cref="IUnitOfWork.InTransactionAsync{T}"/>.
    /// </summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that completes when the lock is held.</returns>
    /// <exception cref="QuoteRequestsBusyException">The lock could not be had in time.</exception>
    /// <exception cref="Csps.Application.Common.ConcurrencyConflictException">The wait was a deadlock victim.</exception>
    Task LockAsync(CancellationToken cancellationToken);

    /// <summary>Lists the requests a sender saved after a time. A sender is the same mobile number, or the same email ignoring case when one is given.</summary>
    /// <param name="contactNumberE164">The mobile number as E.164.</param>
    /// <param name="email">The email, or null when none was given; no request matches on a missing email.</param>
    /// <param name="since">Only requests received after this time count.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The times the sender's requests were received, oldest first.</returns>
    Task<QuoteSenderRecent> CountRecentFromSenderAsync(string contactNumberE164, string? email, DateTimeOffset since, CancellationToken cancellationToken);

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

/// <summary>What the order save needs to answer a request it could not lock (D-23).</summary>
/// <param name="Status">The request's status.</param>
/// <param name="OrderId">The order the request became; null when none.</param>
/// <param name="OrderNumber">That order's number; null when none.</param>
public sealed record QuoteConversionState(QuoteRequestStatus Status, Guid? OrderId, string? OrderNumber);
