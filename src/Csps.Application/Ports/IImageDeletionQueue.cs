using System.Diagnostics.CodeAnalysis;

namespace Csps.Application.Ports;

/// <summary>Why a stored photo file is queued for removal (JOB-02). The number is stored, so never reorder or reuse one.</summary>
public enum ImageDeletionReason
{
    /// <summary>Staff deleted one photo.</summary>
    PhotoDeleted = 1,

    /// <summary>A Manager deleted the whole order for good.</summary>
    OrderDeleted = 2,

    /// <summary>The file reached storage but the photo row could not be saved.</summary>
    UploadUndone = 3,

    /// <summary>The storage sweep found a file no photo row names.</summary>
    Stray = 4,
}

/// <summary>
/// The queue of stored files that must be removed from the photo storage (JOB-02, D-20). A request never calls the storage to delete:
/// it queues the file here, and the maintenance job removes it later and retries until it works.
/// </summary>
[SuppressMessage("Naming", "CA1711:Identifiers should not have incorrect suffix", Justification = "A real queue of removal rows; the rule targets System.Collections types, and the plan names this port.")]
public interface IImageDeletionQueue
{
    /// <summary>
    /// Adds a removal row to the request's unit of work, so it is saved, or rolled back, together with the business change that
    /// caused it. Nothing is saved here.
    /// </summary>
    /// <param name="publicId">The public id of the stored file.</param>
    /// <param name="reason">Why the file is queued.</param>
    void Enqueue(string publicId, ImageDeletionReason reason);

    /// <summary>
    /// Writes a removal row on its own short context and saves it at once, so it survives a failed request. Use it only when no
    /// business change is being saved with it.
    /// </summary>
    /// <param name="publicId">The public id of the stored file.</param>
    /// <param name="reason">Why the file is queued.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the row is saved.</returns>
    Task EnqueueNowAsync(string publicId, ImageDeletionReason reason, CancellationToken cancellationToken);
}
