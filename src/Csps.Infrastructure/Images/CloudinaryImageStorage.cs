using Csps.Application.Ports;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Csps.Infrastructure.Images;

/// <summary>The Cloudinary account as the image storage (IMG-01, D-06).</summary>
/// <param name="options">The account settings.</param>
/// <param name="httpClients">Hands out the Cloudinary HTTP client.</param>
/// <param name="logger">The log.</param>
internal sealed class CloudinaryImageStorage(IOptions<CloudinarySettings> options, IHttpClientFactory httpClients, ILogger<CloudinaryImageStorage> logger) : IImageStorage
{
    /// <summary>The name of the Cloudinary HTTP client.</summary>
    public const string HttpClientName = "cloudinary";

    private readonly CloudinarySettings _settings = options.Value;
    private readonly IHttpClientFactory _httpClients = httpClients;
    private readonly ILogger<CloudinaryImageStorage> _logger = logger;

    public bool IsConfigured => _settings.IsConfigured;

    public string RootFolder => _settings.RootFolder;

    public Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken)
    {
        _ = (_httpClients, _logger);
        return Task.FromResult(ImageUploadOutcome.Failed("not-built"));
    }

    public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken) =>
        Task.FromResult(new ImageRemovalOutcome(ImageRemovalStatus.Rejected, "not-built"));

    public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken) =>
        Task.FromResult(new StoredImagePage([], null));

    public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new StorageUsage(0, 0));
}
