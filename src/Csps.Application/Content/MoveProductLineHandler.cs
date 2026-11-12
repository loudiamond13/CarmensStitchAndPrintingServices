using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager moves a product line one place up or down in the display order (CONT-02, PUB-03). The line trades places with the
/// line next to it in the Manager's list, hidden lines included, in one transaction under the site-content lock, so two Managers moving
/// at once end with every place used once. A move at the end of the order succeeds and changes and records nothing. A change writes one
/// <c>product-line.moved</c> entry with the old and new place. No version is sent: the move applies to the latest order, so a lost race is
/// read again and decided again.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="validator">The form rules.</param>
public sealed class MoveProductLineHandler(
    IProductLines lines,
    ISiteContentLock siteLock,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<MoveProductLineRequest> validator)
{
    /// <summary>Moves the line.</summary>
    /// <param name="id">The line to move.</param>
    /// <param name="request">The direction.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, a 400 for a direction that is not up or down, a 404 when the line does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, MoveProductLineRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(SiteContentErrors.Invalid(validation));
        }

        var up = string.Equals(request.Direction, MoveProductLineRequestValidator.Up, StringComparison.OrdinalIgnoreCase);
        try
        {
            var outcome = await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, up, token), cancellationToken),
                    Result.Failure<bool>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
            return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool up, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<bool>(SiteContentErrors.LineNotFound);
        }

        var neighbour = await lines.FindNeighbourAsync(line, up, cancellationToken).ConfigureAwait(false);
        if (neighbour is null)
        {
            return Result.Success(false);
        }

        var oldPosition = line.Position;
        line.SwapPositionWith(neighbour);
        audit.Record(AuditActions.ProductLineMoved, ProductLineAuditDetail.TargetType, AuditKey.Of(line.Id), ProductLineAuditDetail.Moved(line, oldPosition));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
