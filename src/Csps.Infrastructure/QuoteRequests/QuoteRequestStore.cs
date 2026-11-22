using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary><see cref="IQuoteRequestStore"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class QuoteRequestStore(CspsDbContext context) : IQuoteRequestStore
{
    public void Add(QuoteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        context.QuoteRequests.Add(request);
    }
}
