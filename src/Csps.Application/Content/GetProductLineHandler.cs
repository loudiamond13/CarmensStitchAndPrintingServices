using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>Use case: a Manager reads one product line with every field, its linked product types and its version (CONT-02).</summary>
/// <param name="lines">The product line store.</param>
/// <param name="delivery">Makes the photo addresses.</param>
public sealed class GetProductLineHandler(IProductLines lines, IImageDelivery delivery)
{
    /// <summary>Returns the line.</summary>
    /// <param name="id">The line id.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The line, or a 404 when there is none.</returns>
    public async Task<Result<ProductLineDetailDto>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await lines.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<ProductLineDetailDto>(SiteContentErrors.LineNotFound)
            : Result.Success(ProductLineDetailDto.From(row, delivery));
    }
}
