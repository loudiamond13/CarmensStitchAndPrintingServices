using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary><see cref="IQuoteRequestStore"/> over EF: tracked rows, saved by the unit of work.</summary>
internal sealed class QuoteRequestStore(CspsDbContext context) : IQuoteRequestStore
{
    public void Add(QuoteRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        context.QuoteRequests.Add(request);
    }

    public Task<QuoteProductLine?> FindShownLineAsync(string key, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(key);
        return context.ProductLines
            .AsNoTracking()
            .Where(line => line.IsActive && line.Key == key)
            .Select(line => new QuoteProductLine(line.Id, line.Title))
            .FirstOrDefaultAsync(cancellationToken);
    }
}
