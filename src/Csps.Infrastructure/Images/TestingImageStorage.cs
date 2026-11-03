#if CSPS_TESTING
using System.Collections.Concurrent;
using Csps.Application.Images;
using Csps.Application.Ports;

namespace Csps.Infrastructure.Images;

/// <summary>One upload the Testing storage received.</summary>
/// <param name="PublicId">The public id the file was stored under.</param>
/// <param name="AssetFolder">The asset folder.</param>
/// <param name="Length">The number of bytes.</param>
/// <param name="Kind">The format the bytes were checked as.</param>
public sealed record RecordedImageUpload(string PublicId, string AssetFolder, int Length, ImageKind Kind);

/// <summary>One file the Testing storage holds.</summary>
/// <param name="Bytes">The file bytes.</param>
/// <param name="Kind">The format.</param>
public sealed record StoredTestImage(ReadOnlyMemory<byte> Bytes, ImageKind Kind);

/// <summary>
/// The Testing environment's image storage (D-07): keeps files in memory so tests and end-to-end runs can read them and nothing ever
/// reaches Cloudinary. It exists only in Debug builds (QUAL-05). It records every call, can be told to fail the next calls, and can
/// hold uploads until they are released, so races and failures can be tested without a network.
/// </summary>
/// <param name="time">The clock.</param>
public sealed class TestingImageStorage(TimeProvider time) : IImageStorage
{
    private readonly Lock _gate = new();
    private readonly ConcurrentDictionary<string, (StoredTestImage Image, DateTimeOffset StoredAt)> _files = new(StringComparer.Ordinal);
    private readonly List<RecordedImageUpload> _uploads = [];
    private readonly List<string> _removals = [];
    private int _failuresLeft;
    private ImageUploadOutcome _failure = ImageUploadOutcome.Failed("test-failure");
    private TaskCompletionSource? _hold;

    /// <inheritdoc />
    public bool IsConfigured => true;

    /// <inheritdoc />
    public string RootFolder => "csps-test";

    /// <summary>Gets or sets the usage the storage reports.</summary>
    public StorageUsage Usage { get; set; } = new(0, 0);

    /// <summary>Gets the uploads received, oldest first, including the ones that were told to fail.</summary>
    public IReadOnlyList<RecordedImageUpload> Uploads
    {
        get
        {
            lock (_gate)
            {
                return [.. _uploads];
            }
        }
    }

    /// <summary>Gets the public ids of the removals received, oldest first.</summary>
    public IReadOnlyList<string> Removals
    {
        get
        {
            lock (_gate)
            {
                return [.. _removals];
            }
        }
    }

    /// <summary>Finds a stored file by the last segment of its public id.</summary>
    /// <param name="lastSegment">The part of the public id after its last slash.</param>
    /// <param name="image">The file when found.</param>
    /// <returns>True when a file is stored under an id ending in that segment.</returns>
    public bool TryGet(string lastSegment, out StoredTestImage image)
    {
        foreach (var (publicId, entry) in _files)
        {
            if (publicId.EndsWith("/" + lastSegment, StringComparison.Ordinal))
            {
                image = entry.Image;
                return true;
            }
        }

        image = new StoredTestImage(ReadOnlyMemory<byte>.Empty, ImageKind.Jpeg);
        return false;
    }

    /// <summary>Makes the next uploads fail with a chosen outcome.</summary>
    /// <param name="count">How many uploads to fail.</param>
    /// <param name="outcome">The outcome to answer; a generic failure when null.</param>
    public void FailNext(int count, ImageUploadOutcome? outcome = null)
    {
        lock (_gate)
        {
            _failuresLeft = count;
            _failure = outcome ?? ImageUploadOutcome.Failed("test-failure");
        }
    }

    /// <summary>Makes uploads wait until <see cref="Release"/> is called.</summary>
    public void HoldUploads()
    {
        lock (_gate)
        {
            _hold ??= new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        }
    }

    /// <summary>Lets the held uploads go on.</summary>
    public void Release()
    {
        TaskCompletionSource? hold;
        lock (_gate)
        {
            hold = _hold;
            _hold = null;
        }

        hold?.TrySetResult();
    }

    /// <inheritdoc />
    public async Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(upload);

        Task? wait;
        lock (_gate)
        {
            _uploads.Add(new RecordedImageUpload(upload.PublicId, upload.AssetFolder, upload.Bytes.Length, upload.Kind));
            wait = _hold?.Task;
        }

        if (wait is not null)
        {
            await wait.WaitAsync(cancellationToken).ConfigureAwait(false);
        }

        lock (_gate)
        {
            if (_failuresLeft > 0)
            {
                _failuresLeft--;
                return _failure;
            }
        }

        _files[upload.PublicId] = (new StoredTestImage(upload.Bytes.ToArray(), upload.Kind), time.GetUtcNow());
        return ImageUploadOutcome.Stored;
    }

    /// <inheritdoc />
    public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken)
    {
        lock (_gate)
        {
            _removals.Add(publicId);
        }

        var status = _files.TryRemove(publicId, out _) ? ImageRemovalStatus.Removed : ImageRemovalStatus.NotFound;
        return Task.FromResult(new ImageRemovalOutcome(status));
    }

    /// <inheritdoc />
    public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken)
    {
        var entries = _files
            .Where(file => file.Key.StartsWith(prefix, StringComparison.Ordinal))
            .Select(file => new StoredImageEntry(file.Key, file.Value.StoredAt))
            .OrderBy(entry => entry.PublicId, StringComparer.Ordinal)
            .ToList();
        return Task.FromResult(new StoredImagePage(entries, null));
    }

    /// <inheritdoc />
    public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) => Task.FromResult(Usage);
}
#endif
