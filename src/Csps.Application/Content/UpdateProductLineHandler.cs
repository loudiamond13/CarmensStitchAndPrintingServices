using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager edits a product line with the version the form was opened with (CONT-02, SEC-07, D-09). The steps run in this
/// order and stop at the first failure: the form is checked (400), then in one transaction under the site-content lock the line is found
/// (404), the version is the stored one (409), the short name is not another line's (400 on <c>shortName</c>), every ticked product type
/// exists (400 on <c>productTypeIds</c>) and the values are checked against the domain rules (400). A form save never retries on a
/// conflict. A form with no change saves nothing, writes no audit entry and keeps the version. The key never changes. A change writes
/// <c>product-line.changed</c>, a flip of the shown flag writes <c>product-line.shown</c> or <c>product-line.hidden</c>, and each product
/// type filed, moved or freed writes <c>product-type.line-linked</c>, all in the same save. Product types are left as they are when
/// the form sends no list.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
/// <param name="delivery">Makes the photo addresses of the answer.</param>
public sealed class UpdateProductLineHandler(
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<ProductLineRequest> validator,
    IImageDelivery delivery)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="id">The line to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The line as saved, a 400 naming every field that failed, a 404 when it does not exist, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<ProductLineDetailDto>> HandleAsync(Guid id, ProductLineRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var context = new ValidationContext<ProductLineRequest>(request);
        context.RootContextData[ProductLineRequestValidator.EditKey] = true;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ProductLineDetailDto>(SiteContentErrors.Invalid(validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(token => AttemptAsync(id, version, request, token), cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<ProductLineDetailDto>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<ProductLineDetailDto>(EditErrors.Stale);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<ProductLineDetailDto>(AuthErrors.SessionBusy);
        }

        var row = await lines.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<ProductLineDetailDto>(SiteContentErrors.LineNotFound)
            : Result.Success(ProductLineDetailDto.From(row, delivery));
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, byte[] version, ProductLineRequest request, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<bool>(SiteContentErrors.LineNotFound);
        }

        if (!line.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        // These checks run before the change, so a refused edit leaves the tracked row untouched.
        if (await lines.ShortNameTakenAsync(request.ShortName!.Trim(), line.Id, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<bool>(SiteContentErrors.ShortNameTaken);
        }

        IReadOnlyList<ProductType>? ticked = null;
        if (request.ProductTypeIds is { } ids)
        {
            ticked = await ProductTypeLinker.FindTickedAsync(lines, ids, cancellationToken).ConfigureAwait(false);
            if (ticked is null)
            {
                return Result.Failure<bool>(SiteContentErrors.ProductTypesUnknown);
            }
        }

        var changed = line.Update(request.ToValues());
        if (changed.IsFailure)
        {
            return Result.Failure<bool>(changed.Error);
        }

        var change = changed.Value;
        var key = AuditKey.Of(line.Id);
        if (change.Fields.Count > 0)
        {
            audit.Record(AuditActions.ProductLineChanged, ProductLineAuditDetail.TargetType, key, ProductLineAuditDetail.Changed(change));
        }

        if (change.NowShown is { } shown)
        {
            audit.Record(shown ? AuditActions.ProductLineShown : AuditActions.ProductLineHidden, ProductLineAuditDetail.TargetType, key, ProductLineAuditDetail.Named(line));
        }

        var filed = 0;
        if (ticked is not null)
        {
            var alreadyFiled = await lines.GetLinkedTypesAsync(line.Id, cancellationToken).ConfigureAwait(false);
            filed = await ProductTypeLinker.ApplyAsync(lines, audit, line, ticked, alreadyFiled, cancellationToken).ConfigureAwait(false);
        }

        if (!change.HasChange && filed == 0)
        {
            return Result.Success(false);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
