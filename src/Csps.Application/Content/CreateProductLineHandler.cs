using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.OrderLists;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager adds a product line (CONT-02, D-01, D-09). The form is checked first (400), then one transaction takes the
/// site-content lock, refuses a short name another line already uses (400 on <c>shortName</c>, compared without regard to letter case and
/// trailing spaces), makes the key from the short name, puts the line at the end of the order with the custom drawing, hidden unless the
/// Manager ticked Show on the website, files the ticked order product types under it and saves, with a <c>product-line.added</c> entry. The
/// lock makes two Managers adding at once end with different places in the order and different keys. Who added the line and when come
/// from the token and the clock (SEC-08). A save that loses a deadlock is read again once and is a 409 if it loses again.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateProductLineHandler(
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IValidator<ProductLineRequest> validator)
{
    /// <summary>Adds the line.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new line, a 400 naming every field that failed, or a 409 when the save lost a race.</returns>
    public async Task<Result<ProductLineDetailDto>> HandleAsync(ProductLineRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ProductLineDetailDto>(SiteContentErrors.Invalid(validation));
        }

        Result<Guid> outcome;
        try
        {
            outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(request, token), cancellationToken),
                    Result.Failure<Guid>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<ProductLineDetailDto>(AuthErrors.SessionBusy);
        }

        if (outcome.IsFailure)
        {
            return Result.Failure<ProductLineDetailDto>(outcome.Error);
        }

        var row = await lines.GetDetailAsync(outcome.Value, cancellationToken).ConfigureAwait(false);
        return row is null
            ? Result.Failure<ProductLineDetailDto>(SiteContentErrors.LineNotFound)
            : Result.Success(ProductLineDetailDto.From(row));
    }

    private async Task<Result<Guid>> AttemptAsync(ProductLineRequest request, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var shortName = request.ShortName!.Trim();
        if (await lines.ShortNameTakenAsync(shortName, null, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(SiteContentErrors.ShortNameTaken);
        }

        IReadOnlyList<ProductType>? ticked = null;
        if (request.ProductTypeIds is { Count: > 0 } ids)
        {
            ticked = await ProductTypeLinker.FindTickedAsync(lines, ids, cancellationToken).ConfigureAwait(false);
            if (ticked is null)
            {
                return Result.Failure<Guid>(SiteContentErrors.ProductTypesUnknown);
            }
        }

        var keys = await lines.GetKeysAsync(cancellationToken).ConfigureAwait(false);
        var position = await lines.GetNextPositionAsync(cancellationToken).ConfigureAwait(false);
        var created = ProductLine.Create(request.ToValues(), LineKey.From(shortName, keys), position, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        var line = created.Value;
        lines.Add(line);
        audit.Record(AuditActions.ProductLineAdded, ProductLineAuditDetail.TargetType, AuditKey.Of(line.Id), ProductLineAuditDetail.Named(line));
        if (ticked is not null)
        {
            await ProductTypeLinker.ApplyAsync(lines, audit, line, ticked, [], cancellationToken).ConfigureAwait(false);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(line.Id);
    }
}
