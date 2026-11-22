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

    public async Task<QuotePhotoTarget?> FindForUploadAsync(Guid requestId, CancellationToken cancellationToken)
    {
        var row = await context.QuoteRequests
            .AsNoTracking()
            .Where(request => request.Id == requestId)
            .Select(request => new
            {
                request.Id,
                request.Status,
                request.UploadKeyHash,
                request.UploadKeyExpiresAtUtc,
                EmptySlots = request.Photos.Where(photo => photo.PublicId == null).Select(photo => photo.Slot).ToList(),
            })
            .FirstOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        return row is null ? null : new QuotePhotoTarget(row.Id, row.Status, row.UploadKeyHash, row.UploadKeyExpiresAtUtc, row.EmptySlots);
    }

    public async Task<bool> FillPhotoSlotAsync(Guid requestId, int slot, QuotePhotoStored stored, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(stored);
        var changed = await context.QuoteRequestPhotos
            .Where(photo => photo.QuoteRequestId == requestId
                && photo.Slot == slot
                && photo.PublicId == null
                && context.QuoteRequests.Any(request => request.Id == requestId && request.Status != QuoteRequestStatus.Spam))
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(photo => photo.PublicId, stored.PublicId)
                    .SetProperty(photo => photo.Width, stored.Width)
                    .SetProperty(photo => photo.Height, stored.Height)
                    .SetProperty(photo => photo.Bytes, stored.Bytes)
                    .SetProperty(photo => photo.Kind, stored.Kind)
                    .SetProperty(photo => photo.StoredAtUtc, stored.StoredAtUtc),
                cancellationToken)
            .ConfigureAwait(false);
        return changed == 1;
    }
}
