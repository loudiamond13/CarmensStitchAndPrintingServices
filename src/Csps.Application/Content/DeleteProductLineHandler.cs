using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Content;

/// <summary>Use case: a Manager deletes a product line (CONT-02).</summary>
/// <param name="lines">The product line store.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
public sealed class DeleteProductLineHandler(IProductLines lines, IUnitOfWork unitOfWork)
{
    /// <summary>Deletes the line.</summary>
    /// <param name="id">The line to delete.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, or a 404 when the line does not exist.</returns>
    public async Task<Result> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var line = await lines.FindAsync(id, cancellationToken).ConfigureAwait(false);
        if (line is null)
        {
            return Result.Failure(SiteContentErrors.LineNotFound);
        }

        lines.Remove(line);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
