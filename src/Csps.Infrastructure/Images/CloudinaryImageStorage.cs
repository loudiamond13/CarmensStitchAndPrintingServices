using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Csps.Application.Ports;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;

namespace Csps.Infrastructure.Images;

/// <summary>
/// The shop's Cloudinary account as the image storage (IMG-01, D-05, D-06). Every call is signed on the server with the API secret.
/// Photos use the <c>private</c> delivery type (D-32). A fresh client is made per call so a long-lived address lookup never goes stale,
/// and no call is retried here: a consumed upload stream cannot be sent twice (RESEARCH Pitfall 20).
/// </summary>
/// <param name="options">The account settings.</param>
/// <param name="httpClients">Hands out the Cloudinary HTTP client, which has timeouts only.</param>
/// <param name="logger">The log; it only ever receives short codes and status numbers.</param>
internal sealed partial class CloudinaryImageStorage(IOptions<CloudinarySettings> options, IHttpClientFactory httpClients, ILogger<CloudinaryImageStorage> logger) : IImageStorage
{
    /// <summary>The name of the Cloudinary HTTP client.</summary>
    public const string HttpClientName = "cloudinary";

    private const string PrivateType = "private";

    private static readonly string[] AllowedFormats = ["jpg", "png", "webp", "heic"];

    private readonly CloudinarySettings _settings = options.Value;

    public bool IsConfigured => _settings.IsConfigured;

    public string RootFolder => _settings.RootFolder;

    public async Task<ImageUploadOutcome> UploadAsync(ImageUpload upload, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(upload);
        using var stream = new MemoryStream(upload.Bytes.ToArray(), writable: false);
        var parameters = new ImageUploadParams
        {
            File = new FileDescription("photo", stream),
            PublicId = upload.PublicId,
            AssetFolder = upload.AssetFolder,
            Type = PrivateType,
            Overwrite = false,
            UseFilename = false,
            UniqueFilename = false,
            AllowedFormats = AllowedFormats,
        };

        try
        {
            var result = await NewClient().UploadAsync(parameters, cancellationToken).ConfigureAwait(false);
            var outcome = CloudinaryResults.ForUpload(result.StatusCode);
            if (!outcome.Succeeded)
            {
                LogFailed("upload", outcome.FailureCode ?? CloudinaryResults.RefusedCode, (int)result.StatusCode);
            }

            return outcome;
        }
        catch (Exception failure) when (IsTransientFailure(failure, cancellationToken))
        {
            LogFailed("upload", CloudinaryResults.TransientCode, 0);
            return ImageUploadOutcome.Failed(CloudinaryResults.TransientCode);
        }
    }

    public Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken) =>
        Task.FromResult(new ImageRemovalOutcome(ImageRemovalStatus.Rejected, "not-built"));

    public Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken) =>
        Task.FromResult(new StoredImagePage([], null));

    public Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken) =>
        Task.FromResult(new StorageUsage(0, 0));

    private static bool IsTransientFailure(Exception failure, CancellationToken cancellationToken) => failure switch
    {
        OperationCanceledException => !cancellationToken.IsCancellationRequested,
        HttpRequestException or TimeoutException or JsonException => true,

        // The SDK wraps a body that is not JSON, such as a gateway error page, in a plain Exception.
        { InnerException: JsonException } => true,
        _ => false,
    };

    private Cloudinary NewClient() =>
        new(new Account(_settings.CloudName, _settings.ApiKey, _settings.ApiSecret))
        {
            Api = { Secure = true, Client = httpClients.CreateClient(HttpClientName) },
        };

    [LoggerMessage(Level = LogLevel.Warning, Message = "Cloudinary {Operation} did not work: {Code} (HTTP {Status}).")]
    private partial void LogFailed(string operation, string code, int status);
}
