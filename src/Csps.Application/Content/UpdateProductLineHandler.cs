using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager edits a product line with the version the form was opened with (CONT-02, SEC-07). The steps run in this order
/// and stop at the first failure: the form is checked (400), then in one transaction under the site-content lock the line is found (404),
/// the version is the stored one (409) and the values are checked against the domain rules (400). A form save never retries on a
/// conflict. A form with no change saves nothing and keeps the version. The key never changes.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class UpdateProductLineHandler(
    IProductLines lines,
    ISiteContentLock siteLock,
    IUnitOfWork unitOfWork,
    IValidator<ProductLineRequest> validator)
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
            : Result.Success(ProductLineDetailDto.From(row));
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

        var changed = line.Update(request.ToValues());
        if (changed.IsFailure)
        {
            return Result.Failure<bool>(changed.Error);
        }

        if (!changed.Value.HasChange)
        {
            return Result.Success(false);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
