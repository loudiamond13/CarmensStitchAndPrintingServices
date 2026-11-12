using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager lists every product line, shown and hidden, in display order, each with the version an edit must send back
/// (CONT-02). The list is read from the database, not the public cache.
/// </summary>
/// <param name="lines">The product line store.</param>
public sealed class ListProductLinesHandler(IProductLines lines)
{
    /// <summary>Returns the lines.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The lines in display order.</returns>
    public async Task<Result<IReadOnlyList<ProductLineListItemDto>>> HandleAsync(CancellationToken cancellationToken)
    {
        var rows = await lines.ListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<ProductLineListItemDto>>([.. rows.Select(ProductLineListItemDto.From)]);
    }
}
