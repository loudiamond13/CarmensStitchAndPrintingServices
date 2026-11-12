using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>Use case: a Manager hides a product line or shows it again (CONT-02, D-08, PUB-03). Hiding takes it off the public site.</summary>
/// <param name="lines">The product line store.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class SetProductLineShownHandler(IProductLines lines, IUnitOfWork unitOfWork)
{
    /// <summary>Shows or hides the line.</summary>
    /// <param name="id">The line.</param>
    /// <param name="shown">True to show it, false to hide it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success (also when the line was already so), or a 404 when it does not exist.</returns>
    public async Task<Result> HandleAsync(Guid id, bool shown, CancellationToken cancellationToken)
    {
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure(SiteContentErrors.LineNotFound);
        }

        if (shown ? line.Show() : line.Hide())
        {
            await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        }

        return Result.Success();
    }
}
