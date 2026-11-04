using Csps.Application.Ports;

namespace Csps.Infrastructure.Images;

/// <summary>
/// One row of the ImageDeletions table (JOB-02, D-20): a stored photo file waiting to be removed from the photo storage. The row is
/// written in the same save as the change that made the file unneeded. The maintenance job takes a lease on the row, removes the
/// file and deletes the row, or counts the failure and tries again later.
/// </summary>
public sealed class ImageDeletion
{
    /// <summary>The longest public id.</summary>
    public const int PublicIdMaxLength = 200;

    /// <summary>The longest delivery type name.</summary>
    public const int DeliveryTypeMaxLength = 16;

    /// <summary>The longest failure code.</summary>
    public const int FailureCodeMaxLength = 50;

    private ImageDeletion()
    {
        PublicId = string.Empty;
        DeliveryType = string.Empty;
    }

    /// <summary>Gets the primary key, given by the database.</summary>
    public long Id { get; private set; }

    /// <summary>Gets the public id of the stored file. It is not unique: a sweep and a delete may queue the same file, and a second removal is harmless.</summary>
    public string PublicId { get; private set; }

    /// <summary>Gets the delivery type the file was stored with, <c>private</c> for order photos.</summary>
    public string DeliveryType { get; private set; }

    /// <summary>Gets why the file is queued.</summary>
    public ImageDeletionReason Reason { get; private set; }

    /// <summary>Gets when the row was queued.</summary>
    public DateTimeOffset EnqueuedAtUtc { get; private set; }

    /// <summary>Gets how many removals failed so far.</summary>
    public int Attempts { get; private set; }

    /// <summary>Gets the earliest time the job may try again.</summary>
    public DateTimeOffset NextAttemptAtUtc { get; private set; }

    /// <summary>Gets when the job's lease on the row ends; null when no job holds it.</summary>
    public DateTimeOffset? LeaseUntilUtc { get; private set; }

    /// <summary>Gets the run that holds the lease; null when none does.</summary>
    public Guid? LeaseHolder { get; private set; }

    /// <summary>Gets the short code of the last failure; never the file id.</summary>
    public string? LastFailureCode { get; private set; }

    /// <summary>Gets when the last failure happened.</summary>
    public DateTimeOffset? LastFailedAtUtc { get; private set; }

    /// <summary>Creates a row for a file that must be removed: due now, no attempts, no lease.</summary>
    /// <param name="publicId">The public id of the stored file.</param>
    /// <param name="deliveryType">The delivery type the file was stored with.</param>
    /// <param name="reason">Why the file is queued.</param>
    /// <param name="now">The current UTC time.</param>
    /// <returns>The new, unsaved row.</returns>
    public static ImageDeletion Queue(string publicId, string deliveryType, ImageDeletionReason reason, DateTimeOffset now)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(publicId);
        ArgumentException.ThrowIfNullOrWhiteSpace(deliveryType);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(publicId.Length, PublicIdMaxLength);
        ArgumentOutOfRangeException.ThrowIfGreaterThan(deliveryType.Length, DeliveryTypeMaxLength);
        if (!Enum.IsDefined(reason))
        {
            throw new ArgumentOutOfRangeException(nameof(reason), reason, "The reason is not a known removal reason.");
        }

        return new ImageDeletion
        {
            PublicId = publicId,
            DeliveryType = deliveryType,
            Reason = reason,
            EnqueuedAtUtc = now,
            NextAttemptAtUtc = now,
        };
    }
}
