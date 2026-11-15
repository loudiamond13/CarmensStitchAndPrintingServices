using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager lists the gallery (GAL-03, D-10): every upload and every shown order in the one gallery order, one page at a
/// time, optionally only the items filed under one line. The query is checked first and the port is never called for a bad one. A page
/// past the last answers no rows and the real total, so the screen can step back.
/// </summary>
/// <param name="entries">The gallery store.</param>
/// <param name="delivery">Makes the thumb addresses.</param>
/// <param name="validator">The query rules.</param>
public sealed class ListGalleryItemsHandler(IGalleryEntries entries, IImageDelivery delivery, IValidator<ListGalleryItemsRequest> validator)
{
    /// <summary>Lists one page of gallery items.</summary>
    /// <param name="request">The line filter and the page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, or a 400 naming the bad fields.</returns>
    public async Task<Result<GalleryItemListDto>> HandleAsync(ListGalleryItemsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<GalleryItemListDto>(SiteContentErrors.Invalid(validation));
        }

        _ = ListGalleryItemsRequestValidator.TryParseLine(request.Line, out var line);
        var page = await entries.ListAsync(line == Guid.Empty ? null : line, request.Page, request.PageSize, cancellationToken).ConfigureAwait(false);
        IReadOnlyList<GalleryItemRowDto> rows = [.. page.Rows.Select(row => GalleryItemRowDto.From(row, delivery))];
        return Result.Success(new GalleryItemListDto(rows, page.Total, request.Page, request.PageSize));
    }
}
