using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// <see cref="IGalleryEntries"/> over EF: the rows a handler changes are loaded as tracked rows and saved by the unit of work, so the
/// stamp, audit and cache-clearing interceptors all run.
/// </summary>
internal sealed class GalleryEntries(CspsDbContext context) : IGalleryEntries
{
    public Task<GalleryEntry?> FindForOrderAsync(Guid orderId, CancellationToken cancellationToken) =>
        context.GalleryEntries.SingleOrDefaultAsync(entry => entry.OrderId == orderId, cancellationToken);

    // Positions are given out under the site-content lock, so two writers never take the same top place.
    public async Task<int> GetTopPositionAsync(CancellationToken cancellationToken) =>
        (await context.GalleryEntries.MinAsync(entry => (int?)entry.Position, cancellationToken).ConfigureAwait(false) ?? 1) - 1;

    public void Add(GalleryEntry entry) => context.GalleryEntries.Add(entry);

    public void Remove(GalleryEntry entry) => context.GalleryEntries.Remove(entry);
}
