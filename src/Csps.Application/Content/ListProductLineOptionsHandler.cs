using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: staff of either role list the active product lines, in display order, for the "show on the website" window of an order
/// (D-16). A hidden line is not offered. Only the id, title and short name leave the server. The list is read from the database, not the
/// public cache.
/// </summary>
/// <param name="lines">The product line store.</param>
public sealed class ListProductLineOptionsHandler(IProductLines lines)
{
    /// <summary>Returns the active lines.</summary>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The active lines in display order.</returns>
    public async Task<Result<IReadOnlyList<ProductLineOptionDto>>> HandleAsync(CancellationToken cancellationToken)
    {
        var rows = await lines.ListAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success<IReadOnlyList<ProductLineOptionDto>>(
            [.. rows.Where(row => row.Line.IsActive).Select(row => new ProductLineOptionDto(row.Line.Id, row.Line.Title, row.Line.ShortName))]);
    }
}
