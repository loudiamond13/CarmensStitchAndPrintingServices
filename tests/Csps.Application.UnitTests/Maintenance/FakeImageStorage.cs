using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>A scripted photo storage for the job tests: removals answer from a script, listings from fixed pages, and every call is counted.</summary>
internal sealed class FakeImageStorage : IImageStorage
{
    private readonly Queue<ImageRemovalOutcome> _removalScript = new();
    private readonly Dictionary<string, StoredImagePage> _pages = new(StringComparer.Ordinal);

    public bool IsConfigured { get; set; } = true;

    public string RootFolder { get; set; } = "csps-test";

    /// <summary>Gets the ids removals were asked for, in order, including the ones that failed.</summary>
    public List<string> Removals { get; } = [];

    /// <summary>Gets the prefixes and cursors the listing was asked for, in order.</summary>
    public List<(string Prefix, string? Cursor)> Listings { get; } = [];

    /// <summary>Gets or sets what runs just before each removal answers.</summary>
    public Action<string>? OnRemove { get; set; }

    /// <summary>Gets or sets what runs just after each listing answers.</summary>
    public Action? OnList { get; set; }

    /// <summary>Gets or sets an error every listing throws.</summary>
    public Exception? ListFailure { get; set; }

    /// <summary>Gets or sets an error every removal throws.</summary>
    public Exception? RemoveFailure { get; set; }

    public void Script(params ImageRemovalOutcome[] outcomes)
    {
        foreach (var outcome in outcomes)
        {
            _removalScript.Enqueue(outcome);
        }
    }

    public void Page(string? cursor, StoredImagePage page) => _pages[cursor ?? string.Empty] = page;

    public Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken) =>
        throw new NotSupportedException("The jobs never upload.");

    public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken)
    {
        Removals.Add(publicId);
        OnRemove?.Invoke(publicId);
        if (RemoveFailure is not null)
        {
            throw RemoveFailure;
        }

        return Task.FromResult(_removalScript.Count > 0 ? _removalScript.Dequeue() : new ImageRemovalOutcome(ImageRemovalStatus.Removed));
    }

    public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken)
    {
        Listings.Add((prefix, cursor));
        if (ListFailure is not null)
        {
            throw ListFailure;
        }

        var answer = _pages.TryGetValue(cursor ?? string.Empty, out var page) ? page : new StoredImagePage([], null);
        OnList?.Invoke();
        return Task.FromResult(answer);
    }

    public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) =>
        throw new NotSupportedException("These jobs never read the usage.");
}
