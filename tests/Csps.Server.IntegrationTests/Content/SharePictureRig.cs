using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// A host, a Manager and the calls the share picture tests make. The settings row is never reset by the database fixture, so the rig
/// clears the share picture columns when it starts and when it ends.
/// </summary>
internal sealed class SharePictureRig : IAsyncDisposable
{
    public const string Route = "/api/v1/site-settings/share-picture";

    private SharePictureRig(CspsDatabase database, WebApplicationFactory<Program> factory, StartedSession manager)
    {
        Database = database;
        Factory = factory;
        Manager = manager;
    }

    public CspsDatabase Database { get; }

    public WebApplicationFactory<Program> Factory { get; }

    public StartedSession Manager { get; }

    public static async Task<SharePictureRig> StartAsync(CspsDatabase database, bool reset = true)
    {
        if (reset)
        {
            await database.ResetAsync();
        }

        await ClearAsync(database);
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        return new SharePictureRig(database, factory, await TestSessions.StartAsync(factory, Roles.Manager));
    }

    public async ValueTask DisposeAsync()
    {
        await Factory.DisposeAsync();
        await ClearAsync(Database);
    }

    /// <summary>Puts the share picture columns back to null.</summary>
    public static async Task ClearAsync(CspsDatabase database)
    {
        await using var context = database.CreateContext();
        await context.SiteSettings.ExecuteUpdateAsync(
            set => set
                .SetProperty(row => row.SharePicturePublicId, (string?)null)
                .SetProperty(row => row.SharePictureWidth, (int?)null)
                .SetProperty(row => row.SharePictureHeight, (int?)null)
                .SetProperty(row => row.SharePictureBytes, (int?)null)
                .SetProperty(row => row.SharePictureFormat, (string?)null),
            TestContext.Current.CancellationToken);
    }

    /// <summary>Uploads a file as the share picture with the multipart form the Business Info card sends.</summary>
    public async Task<HttpResponseMessage> UploadAsync(byte[] file, StartedSession? who = null, string? idempotencyKey = null, string fileName = "preview.jpg")
    {
        const string boundary = "csps-share-picture-boundary";
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, Route, (who ?? Manager).AccessToken);
        request.Headers.Add("Idempotency-Key", idempotencyKey ?? Guid.NewGuid().ToString("D"));
        using var content = new ByteArrayContent(MultipartBodies.Build(boundary, [MultipartPart.Upload("file", file, fileName)]));
        content.Headers.ContentType = new MediaTypeHeaderValue("multipart/form-data") { Parameters = { new NameValueHeaderValue("boundary", boundary) } };
        request.Content = content;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    public async Task<HttpResponseMessage> RemoveAsync(StartedSession? who = null)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Delete, Route, (who ?? Manager).AccessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the staff settings as JSON.</summary>
    public async Task<JsonDocument> SettingsAsync(StartedSession? who = null)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Get, "/api/v1/site-settings", (who ?? Manager).AccessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        return JsonDocument.Parse(text);
    }

    /// <summary>Reads a page's server HTML.</summary>
    public async Task<string> PageAsync(string path)
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
        return await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    }
}
