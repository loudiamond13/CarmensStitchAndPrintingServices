using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager hides a product line or shows it again (CONT-02, D-08, PUB-03). Hiding takes the line and everything filed under
/// it off the public site; nothing is lost. One transaction flips the flag and writes <c>product-line.hidden</c> or
/// <c>product-line.shown</c>. Hiding a hidden line, or showing a shown one, succeeds and changes and records nothing. No version is
/// sent: the change applies to the latest state, so a lost race is read again and decided again.
/// </summary>
/// <param name="lines">The product line store.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class SetProductLineShownHandler(IProductLines lines, IAuditTrail audit, IUnitOfWork unitOfWork)
{
    /// <summary>Shows or hides the line.</summary>
    /// <param name="id">The line.</param>
    /// <param name="shown">True to show it, false to hide it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when the line was already so), a 404 when it does not exist, or a 409 when two saves lost a race twice.</returns>
    public async Task<Result> HandleAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, shown, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        return outcome.IsFailure ? Result.Failure(outcome.Error) : Result.Success();
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure<bool>(SiteContentErrors.LineNotFound);
        }

        if (!(shown ? line.Show() : line.Hide()))
        {
            return Result.Success(false);
        }

        audit.Record(
            shown ? AuditActions.ProductLineShown : AuditActions.ProductLineHidden,
            ProductLineAuditDetail.TargetType,
            AuditKey.Of(line.Id),
            ProductLineAuditDetail.Named(line));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
