using System.Globalization;
using CloudinaryDotNet;
using CloudinaryDotNet.Actions;
using Csps.Application.Ports;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

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

    public async Task<ImageRemovalOutcome> RemoveAsync(string publicId, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(publicId);

        // The SDK's destroy call takes no cancellation token, so the HTTP timeout is the guard once it has started.
        cancellationToken.ThrowIfCancellationRequested();
        try
        {
            var result = await NewClient().DestroyAsync(new DeletionParams(publicId) { Type = PrivateType, Invalidate = true }).ConfigureAwait(false);
            var outcome = CloudinaryResults.ForRemoval(result.StatusCode, result.Result);
            if (outcome.Status is not (ImageRemovalStatus.Removed or ImageRemovalStatus.NotFound))
            {
                LogFailed("remove", outcome.FailureCode ?? CloudinaryResults.RefusedCode, (int)result.StatusCode);
            }

            return outcome;
        }
        catch (Exception failure) when (IsTransientFailure(failure, cancellationToken))
        {
            LogFailed("remove", CloudinaryResults.TransientCode, 0);
            return new ImageRemovalOutcome(ImageRemovalStatus.Transient, CloudinaryResults.TransientCode);
        }
    }

    public async Task<StoredImagePage> ListAsync(string prefix, string? cursor, CancellationToken cancellationToken)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(prefix);
        var parameters = new ListResourcesByPrefixParams
        {
            Prefix = prefix,
            Type = PrivateType,
            MaxResults = 500,
            NextCursor = string.IsNullOrEmpty(cursor) ? null : cursor,
        };

        var json = await ReadAsync("list", client => client.ListResourcesAsync(parameters, cancellationToken), cancellationToken).ConfigureAwait(false);
        var entries = new List<StoredImageEntry>();
        foreach (var resource in json["resources"] ?? new JArray())
        {
            var publicId = resource.Value<string>("public_id");
            var createdAt = ReadTime(resource["created_at"]);
            if (publicId is not null && createdAt is not null)
            {
                entries.Add(new StoredImageEntry(publicId, createdAt.Value));
            }
        }

        var next = json.Value<string>("next_cursor");
        return new StoredImagePage(entries, string.IsNullOrEmpty(next) ? null : next);
    }

    public async Task<StorageUsage> GetUsageAsync(CancellationToken cancellationToken)
    {
        var json = await ReadAsync("usage", client => client.GetUsageAsync(cancellationToken), cancellationToken).ConfigureAwait(false);

        // Read from the raw JSON: the SDK's credit figures are whole numbers, and the plan's credits come in tenths.
        return new StorageUsage(
            StoragePercent: json["storage"]?.Value<double?>("used_percent") ?? 0,
            CreditsPercent: json["credits"]?.Value<double?>("used_percent") ?? 0,
            StorageBytes: json["storage"]?.Value<long?>("usage") ?? 0,
            CreditsUsed: json["credits"]?.Value<double?>("usage") ?? 0,
            CreditsLimit: json["credits"]?.Value<double?>("limit") ?? 0,
            ImageMaxBytes: json["media_limits"]?.Value<long?>("image_max_size_bytes") ?? 0);
    }

    private static bool IsTransientFailure(Exception failure, CancellationToken cancellationToken) => failure switch
    {
        OperationCanceledException => !cancellationToken.IsCancellationRequested,
        HttpRequestException or TimeoutException or JsonException => true,

        // The SDK wraps a body that is not JSON, such as a gateway error page, in a plain Exception.
        { InnerException: JsonException } => true,
        _ => false,
    };

    // Newtonsoft turns an ISO date string into a DateTime while parsing, so both a date and a string are handled.
    private static DateTimeOffset? ReadTime(JToken? token) => token?.Type switch
    {
        JTokenType.Date => AsUtc(token.Value<DateTime>()),
        JTokenType.String when DateTimeOffset.TryParse(token.Value<string>(), CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed) => parsed.ToUniversalTime(),
        _ => null,
    };

    private static DateTimeOffset AsUtc(DateTime value) =>
        new(value.Kind == DateTimeKind.Unspecified ? DateTime.SpecifyKind(value, DateTimeKind.Utc) : value.ToUniversalTime());

    // Runs a read call and returns its JSON; any failure becomes an ImageStorageException with a short code.
    private async Task<JToken> ReadAsync<TResult>(string operation, Func<Cloudinary, Task<TResult>> call, CancellationToken cancellationToken)
        where TResult : BaseResult
    {
        try
        {
            var result = await call(NewClient()).ConfigureAwait(false);
            if (!CloudinaryResults.IsSuccess(result.StatusCode))
            {
                var code = CloudinaryResults.FailureCode(result.StatusCode);
                LogFailed(operation, code, (int)result.StatusCode);
                throw new ImageStorageException(code);
            }

            return result.JsonObj ?? new JObject();
        }
        catch (Exception failure) when (IsTransientFailure(failure, cancellationToken))
        {
            LogFailed(operation, CloudinaryResults.TransientCode, 0);
            throw new ImageStorageException(CloudinaryResults.TransientCode);
        }
    }

    private Cloudinary NewClient() =>
        new(new Account(_settings.CloudName, _settings.ApiKey, _settings.ApiSecret))
        {
            Api = { Secure = true, Client = httpClients.CreateClient(HttpClientName) },
        };

    [LoggerMessage(Level = LogLevel.Warning, Message = "Cloudinary {Operation} did not work: {Code} (HTTP {Status}).")]
    private partial void LogFailed(string operation, string code, int status);
}
