using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>The tracked store of quote requests: new requests are added and saved by <see cref="IUnitOfWork"/>.</summary>
public interface IQuoteRequestStore
{
    /// <summary>Adds a new request to the unit of work. Nothing is saved here.</summary>
    /// <param name="request">The new request.</param>
    void Add(QuoteRequest request);
}
