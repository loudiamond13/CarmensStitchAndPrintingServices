using Csps.Application.Ports;
using Csps.Domain.QuoteRequests;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.QuoteRequests;

/// <summary><see cref="IQuoteRequestReader"/> over EF: untracked reads, no raw SQL.</summary>
internal sealed class QuoteRequestReader(CspsDbContext context) : IQuoteRequestReader
{
    // New, Contacted and Quoted; listed by name so the group never depends on the enum order.
    private static readonly QuoteRequestStatus[] OpenStatuses = [QuoteRequestStatus.New, QuoteRequestStatus.Contacted, QuoteRequestStatus.Quoted];

    public async Task<QuoteRequestListPage> ListAsync(QuoteRequestListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var matches = context.QuoteRequests.AsNoTracking().Where(request => OpenStatuses.Contains(request.Status));

        // Command 1: the count over every page. Command 2: the page, newest received first and ending on the id so paging is stable.
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);
        var rows = await matches
            .OrderByDescending(request => request.CreatedAtUtc)
            .ThenByDescending(request => request.Id)
            .Skip((query.Page - 1) * query.Size)
            .Take(query.Size)
            .Select(request => new QuoteRequestListRow(
                request.Id,
                request.CreatedAtUtc,
                request.CustomerName,
                request.TeamName,
                request.ContactNumberE164,
                request.ProductChoice,
                request.ProductTitle,
                request.QuantityRange,
                request.Photos.Count,
                request.Photos.Count(photo => photo.PublicId != null),
                false, // Nothing removes photos until the Spam move (plan 13-16) adds the column this reads.
                request.Status))
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return new QuoteRequestListPage(rows, total);
    }
}
