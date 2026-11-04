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

/// <summary>One queued removal that a run now holds the lease on. The public id is the file's key, so it is never logged.</summary>
/// <param name="Id">The row id, safe to log.</param>
/// <param name="PublicId">The public id of the stored file.</param>
/// <param name="Attempts">How many removals failed so far.</param>
public sealed record QueuedRemoval(long Id, string PublicId, int Attempts);

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

    /// <summary>
    /// Writes several removal rows on one short context and saves them at once. A sweep and a delete may queue the same id: the second
    /// removal is a harmless NotFound.
    /// </summary>
    /// <param name="publicIds">The public ids of the stored files.</param>
    /// <param name="reason">Why the files are queued.</param>
    /// <param name="cancellationToken">Cancels the write.</param>
    /// <returns>A task that completes once the rows are saved.</returns>
    Task EnqueueManyNowAsync(IReadOnlyCollection<string> publicIds, ImageDeletionReason reason, CancellationToken cancellationToken);

    /// <summary>
    /// Takes the lease on up to <paramref name="max"/> due rows. A row is due when its next attempt time has come and its lease is free or
    /// expired. Each row is taken with its own conditional update, so when two runs race for a row exactly one owns it.
    /// </summary>
    /// <param name="holder">The id of the run that takes the leases.</param>
    /// <param name="now">The time the rows must be due by; also the start of the leases.</param>
    /// <param name="lease">How long the run may hold a row before another run can take it.</param>
    /// <param name="max">The most rows to take.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The rows this run now owns.</returns>
    Task<IReadOnlyList<QueuedRemoval>> ClaimDueAsync(Guid holder, DateTimeOffset now, TimeSpan lease, int max, CancellationToken cancellationToken);

    /// <summary>Deletes a row whose file is gone, when the run still holds its lease.</summary>
    /// <param name="id">The row id.</param>
    /// <param name="holder">The run that holds the lease.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the row is deleted.</returns>
    Task CompleteAsync(long id, Guid holder, CancellationToken cancellationToken);

    /// <summary>
    /// Records a failed removal: one more attempt, the failure code and time, and the lease let go. The row keeps its place and is due
    /// again for the next run.
    /// </summary>
    /// <param name="id">The row id.</param>
    /// <param name="holder">The run that holds the lease.</param>
    /// <param name="failureCode">A short code, never the file id.</param>
    /// <param name="now">The time of the failure.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the failure is saved.</returns>
    Task FailAsync(long id, Guid holder, string failureCode, DateTimeOffset now, CancellationToken cancellationToken);

    /// <summary>Lets go of the leases a run still holds on rows it did not get to, so the next call can take them at once.</summary>
    /// <param name="ids">The row ids.</param>
    /// <param name="holder">The run that holds the leases.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>A task that completes once the leases are released.</returns>
    Task ReleaseAsync(IReadOnlyCollection<long> ids, Guid holder, CancellationToken cancellationToken);
}
