using Csps.Application.Ports;
using Csps.Domain.Content;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Content;

/// <summary>
/// <see cref="IProductLines"/> over EF: reads are untracked, and the rows a handler changes are loaded as tracked rows and saved by the
/// unit of work, so the stamp, audit and cache-clearing interceptors all run. The staff read is never cached.
/// </summary>
internal sealed class ProductLines(CspsDbContext context) : IProductLines
{
    public async Task<IReadOnlyList<ProductLineListRow>> ListAsync(CancellationToken cancellationToken)
    {
        var lines = await context.ProductLines
            .AsNoTracking()
            .OrderBy(line => line.Position)
            .ThenBy(line => line.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var types = await context.ProductTypes
            .AsNoTracking()
            .Where(type => type.ProductLineId != null)
            .OrderBy(type => type.Name)
            .Select(type => new { type.Id, LineId = type.ProductLineId!.Value })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        var photos = await context.ProductLinePhotos
            .AsNoTracking()
            .GroupBy(photo => photo.LineId)
            .Select(group => new { LineId = group.Key, Count = group.Count() })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        // Gallery items arrive with the gallery plan, so none are counted yet.
        return
        [
            .. lines.Select(line => new ProductLineListRow(
                line,
                [.. types.Where(type => type.LineId == line.Id).Select(type => type.Id)],
                photos.Where(photo => photo.LineId == line.Id).Select(photo => photo.Count).FirstOrDefault(),
                0)),
        ];
    }

    // The last changer comes from the user row, so a rename shows at once and a deleted person keeps their name.
    public async Task<ProductLineDetailRow?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await (
            from line in context.ProductLines.AsNoTracking()
            where line.Id == id
            join changerUser in context.Users on line.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                Line = line,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (row is null)
        {
            return null;
        }

        var typeIds = await context.ProductTypes
            .AsNoTracking()
            .Where(type => type.ProductLineId == id)
            .OrderBy(type => type.Name)
            .Select(type => type.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);
        return new ProductLineDetailRow(row.Line, typeIds, row.ChangerFirst is null ? null : $"{row.ChangerFirst} {row.ChangerLast}");
    }

    public Task<ProductLine?> FindAsync(Guid id, CancellationToken cancellationToken) =>
        context.ProductLines.SingleOrDefaultAsync(line => line.Id == id, cancellationToken);

    // Positions are made unique by the add and the swap, which both run under the site-content lock.
    public Task<ProductLine?> FindNeighbourAsync(ProductLine line, bool up, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(line);
        var position = line.Position;
        return up
            ? context.ProductLines.Where(other => other.Position < position).OrderByDescending(other => other.Position).ThenBy(other => other.Id).FirstOrDefaultAsync(cancellationToken)
            : context.ProductLines.Where(other => other.Position > position).OrderBy(other => other.Position).ThenBy(other => other.Id).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlySet<string>> GetKeysAsync(CancellationToken cancellationToken)
    {
        var keys = await context.ProductLines.AsNoTracking().Select(line => line.Key).ToListAsync(cancellationToken).ConfigureAwait(false);
        return new HashSet<string>(keys, StringComparer.OrdinalIgnoreCase);
    }

    public async Task<int> GetNextPositionAsync(CancellationToken cancellationToken) =>
        (await context.ProductLines.MaxAsync(line => (int?)line.Position, cancellationToken).ConfigureAwait(false) ?? 0) + 1;

    public void Add(ProductLine line) => context.ProductLines.Add(line);

    public void Remove(ProductLine line) => context.ProductLines.Remove(line);
}
