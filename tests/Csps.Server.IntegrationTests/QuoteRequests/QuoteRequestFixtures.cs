using System.Buffers.Text;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>Builds anonymous quote request posts for the Phase 13 tests.</summary>
internal static class QuoteRequestFixtures
{
    /// <summary>The public create route.</summary>
    public const string Route = "/api/v1/public/quote-requests";

    /// <summary>A body the server accepts: a name and a mobile number, nothing else.</summary>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> MinimalBody() => new()
    {
        ["customerName"] = "Juan Dela Cruz",
        ["contactNumber"] = "0917 123 4567",
    };

    /// <summary>Posts a quote request without a sign-in.</summary>
    /// <param name="client">The client.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, Route);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Makes an upload key the way the browser does: 32 random bytes as base64url text.</summary>
    /// <returns>The key.</returns>
    public static string NewUploadKey() => Base64Url.EncodeToString(RandomNumberGenerator.GetBytes(32));

    /// <summary>Saves a request that names photos and returns its id and the upload key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="fileNames">The file names the visitor declares.</param>
    /// <param name="uploadKey">The key; a fresh one when null.</param>
    /// <returns>The new request id.</returns>
    public static async Task<Guid> CreateWithPhotosAsync(HttpClient client, IReadOnlyList<string> fileNames, string uploadKey)
    {
        ArgumentNullException.ThrowIfNull(client);
        var body = MinimalBody();
        body["photos"] = fileNames;
        body["uploadKey"] = uploadKey;
        using var response = await PostAsync(client, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    /// <summary>Posts one photo to a slot of a request.</summary>
    /// <param name="client">The client.</param>
    /// <param name="requestId">The request id in the route.</param>
    /// <param name="slot">The slot text in the route.</param>
    /// <param name="uploadKey">The <c>X-Upload-Key</c> header; none when null.</param>
    /// <param name="file">The file bytes; no file part when null.</param>
    /// <param name="fileName">The file name of the part.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostPhotoAsync(
        HttpClient client, Guid requestId, string slot, string? uploadKey, byte[]? file, string fileName = "photo.jpg")
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{requestId:D}/photos/{slot}");
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        if (uploadKey is not null)
        {
            request.Headers.Add(UploadKeyHeader, uploadKey);
        }

        if (file is not null)
        {
            request.Content = MultipartBodies.Content("csps-quote-boundary", [MultipartPart.Upload("file", file, fileName)]);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>The header that carries the upload key.</summary>
    public const string UploadKeyHeader = "X-Upload-Key";
}
