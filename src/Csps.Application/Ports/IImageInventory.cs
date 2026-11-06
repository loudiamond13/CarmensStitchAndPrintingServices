namespace Csps.Application.Ports;

/// <summary>
/// Tells the maintenance jobs which stored photo files the database still knows (JOB-02, D-23). A photo of a soft-deleted order counts:
/// the order can be restored, and a Cloudinary removal cannot be undone. Ids compare without regard to case, which only ever keeps a
/// file that a strict compare would have removed.
/// </summary>
public interface IImageInventory
{
    /// <summary>Finds which of the given ids a photo row names or a removal row already holds.</summary>
    /// <param name="publicIds">The public ids to check.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The ids that are known.</returns>
    Task<IReadOnlySet<string>> KnownAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken);

    /// <summary>Finds which of the given ids a photo row names, whether or not its order is deleted.</summary>
    /// <param name="publicIds">The public ids to check.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The ids that a photo row names.</returns>
    Task<IReadOnlySet<string>> NamedByPhotosAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken);
}
