using Csps.Application.Ports;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The image storage of a host that has none set up yet (RESEARCH Pitfall 22). The host starts and <c>/health</c> stays green; an
/// upload answers 503 before it reaches here, and a removal or listing is not attempted.
/// </summary>
internal sealed class UnconfiguredImageStorage : IImageStorage
{
    private const string NotConfigured = "not-configured";

    public bool IsConfigured => false;

    public string RootFolder => "csps";

    public Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken) =>
        Task.FromResult(ImageUploadOutcome.Failed(NotConfigured));

    public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken) =>
        Task.FromResult(new ImageRemovalOutcome(ImageRemovalStatus.Rejected, NotConfigured));

    public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken) =>
        Task.FromResult(new StoredImagePage([], null));

    public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new StorageUsage(0, 0));
}
