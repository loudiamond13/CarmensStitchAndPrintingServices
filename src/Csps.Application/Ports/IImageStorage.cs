using Csps.Application.Images;

namespace Csps.Application.Ports;

/// <summary>A photo file for the storage to keep.</summary>
/// <param name="PublicId">The random id to store it under.</param>
/// <param name="AssetFolder">The folder the asset sits in, for example <c>csps/orders/{orderId}</c>.</param>
/// <param name="Bytes">The file bytes, already checked.</param>
/// <param name="Kind">The format the bytes were checked as.</param>
public sealed record ImageUpload(string PublicId, string AssetFolder, ReadOnlyMemory<byte> Bytes, ImageKind Kind);

/// <summary>What happened to an upload.</summary>
/// <param name="Succeeded">True when the storage kept the file.</param>
/// <param name="FailureCode">A short code for the log when it did not; never file bytes or addresses.</param>
public sealed record ImageUploadOutcome(bool Succeeded, string? FailureCode = null)
{
    /// <summary>Gets the outcome of an upload that worked.</summary>
    public static ImageUploadOutcome Stored { get; } = new(true);

    /// <summary>Builds the outcome of an upload that did not work.</summary>
    /// <param name="code">A short code naming the cause.</param>
    /// <returns>The failed outcome.</returns>
    public static ImageUploadOutcome Failed(string code) => new(false, code);
}

/// <summary>How a removal ended.</summary>
public enum ImageRemovalStatus
{
    /// <summary>The file was removed.</summary>
    Removed = 1,

    /// <summary>There was no such file, so there is nothing left to remove.</summary>
    NotFound = 2,

    /// <summary>The storage did not answer in time or was busy; try again later.</summary>
    Transient = 3,

    /// <summary>The storage refused the call, for example because the keys are wrong; trying again will not help.</summary>
    Rejected = 4,
}

/// <summary>What happened to a removal.</summary>
/// <param name="Status">How it ended.</param>
/// <param name="FailureCode">A short code for the log when it did not work out.</param>
public sealed record ImageRemovalOutcome(ImageRemovalStatus Status, string? FailureCode = null);

/// <summary>One stored file seen when listing a folder.</summary>
/// <param name="PublicId">The id it is stored under.</param>
/// <param name="CreatedAtUtc">When it was stored.</param>
public sealed record StoredImageEntry(string PublicId, DateTimeOffset CreatedAtUtc);

/// <summary>One page of a folder listing.</summary>
/// <param name="Entries">The files on the page.</param>
/// <param name="NextCursor">The cursor for the next page; null on the last page.</param>
public sealed record StoredImagePage(IReadOnlyList<StoredImageEntry> Entries, string? NextCursor);

/// <summary>How much of the free plan is used.</summary>
/// <param name="StoragePercent">The share of the storage allowance used, from 0 to 100.</param>
/// <param name="CreditsPercent">The share of this month's credits used, from 0 to 100.</param>
/// <param name="StorageBytes">The bytes stored.</param>
/// <param name="CreditsUsed">The credits used this month.</param>
/// <param name="CreditsLimit">The credits the plan gives each month.</param>
/// <param name="ImageMaxBytes">The largest image file the plan accepts, in bytes; 0 when the storage did not say.</param>
public sealed record StorageUsage(
    double StoragePercent,
    double CreditsPercent,
    long StorageBytes = 0,
    double CreditsUsed = 0,
    double CreditsLimit = 0,
    long ImageMaxBytes = 0);

/// <summary>
/// The place order photos are kept (IMG-01): the server uploads to it, removes from it, lists it and reads its usage. The Cloudinary
/// adapter sits behind it; tests use an in-memory store and never reach Cloudinary (D-07).
/// </summary>
public interface IImageStorage
{
    /// <summary>Gets a value indicating whether the storage is set up. When it is not, an upload answers 503 instead of failing at start.</summary>
    bool IsConfigured { get; }

    /// <summary>Gets the root folder of this environment, for example <c>csps</c> or <c>csps-dev</c> (D-07).</summary>
    string RootFolder { get; }

    /// <summary>Stores one file.</summary>
    /// <param name="upload">The file and where to put it.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Whether the storage kept it.</returns>
    Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken);

    /// <summary>Removes one file and clears its cached copies.</summary>
    /// <param name="publicId">The id the file is stored under.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>How the removal ended.</returns>
    Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken);

    /// <summary>Lists the files under a folder prefix, a page at a time.</summary>
    /// <param name="prefix">The folder prefix, for example <c>csps/orders/</c>.</param>
    /// <param name="cursor">The cursor of the page to read; null for the first.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>One page of files.</returns>
    /// <exception cref="ImageStorageException">The storage could not be read.</exception>
    Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken);

    /// <summary>Reads how much of the free plan is used.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The usage.</returns>
    /// <exception cref="ImageStorageException">The storage could not be read.</exception>
    Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken);
}
