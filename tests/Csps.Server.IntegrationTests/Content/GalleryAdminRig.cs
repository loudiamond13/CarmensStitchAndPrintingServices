using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>One gallery item row as the Manager's list reads it.</summary>
/// <param name="Id">The entry id.</param>
/// <param name="Kind">order or upload.</param>
/// <param name="Name">The name shown.</param>
/// <param name="LineId">The line the item is filed under.</param>
/// <param name="LineShortName">The line short name.</param>
/// <param name="LineHidden">True while the line is hidden.</param>
/// <param name="Pieces">The pieces.</param>
/// <param name="IsShown">True while the item can show.</param>
/// <param name="OrderId">The order of an order item.</param>
/// <param name="OrderNumber">The number of an order item.</param>
/// <param name="Note">The note of an upload.</param>
/// <param name="Thumb">The thumb address.</param>
/// <param name="Version">The version an upload edit sends back.</param>
internal sealed record GalleryRow(
    Guid Id,
    string Kind,
    string Name,
    Guid? LineId,
    string? LineShortName,
    bool LineHidden,
    int? Pieces,
    bool IsShown,
    Guid? OrderId,
    string? OrderNumber,
    string? Note,
    string? Thumb,
    string? Version);

/// <summary>One page of the Manager's gallery list.</summary>
/// <param name="Rows">The rows of the page.</param>
/// <param name="Total">The rows over every page of the filter.</param>
/// <param name="Page">The page number.</param>
/// <param name="Size">The page size.</param>
internal sealed record GalleryPage(List<GalleryRow> Rows, int Total, int Page, int Size);

/// <summary>What a test sends to add an upload; null members are left out of the form.</summary>
/// <param name="Team">The team or name.</param>
/// <param name="LineId">The line.</param>
/// <param name="Pieces">The pieces as text.</param>
/// <param name="Note">The note.</param>
/// <param name="IsShown">True to show it.</param>
internal sealed record UploadForm(string? Team, Guid? LineId, string? Pieces = null, string? Note = null, bool? IsShown = true)
{
    /// <summary>Gets a valid form for a made-up team on the moto line.</summary>
    public static UploadForm Riders { get; } = new("Tondo Sample Riders", GallerySeeding.LineId("moto"), "12", "Dri-fit mesh, V-neck", true);
}

/// <summary>A host and a Manager for the gallery admin tests. The six lines are back, five product types are filed under them, and every call goes through the real routes.</summary>
internal sealed class GalleryAdminRig : IAsyncDisposable
{
    public const string Route = "/api/v1/gallery-items";

    private GalleryAdminRig(CspsDatabase database, CspsApiFactory factory, StartedSession manager)
    {
        Database = database;
        Factory = factory;
        Manager = manager;
    }

    public CspsDatabase Database { get; }

    public CspsApiFactory Factory { get; }

    public StartedSession Manager { get; }

    public static async Task<GalleryAdminRig> StartAsync(CspsDatabase database)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        await GallerySeeding.LinkProductTypesAsync(database);
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        return new GalleryAdminRig(database, factory, await TestSessions.StartAsync(factory, Roles.Manager));
    }

    /// <summary>Gets the order steps (create, photograph, show) of the public gallery tests, over this rig's host and Manager. It does not own the host.</summary>
    public PublicGalleryRig Orders => new(Database, Factory, Manager);

    public async ValueTask DisposeAsync() => await Factory.DisposeAsync();

    public async Task<HttpResponseMessage> SendAsync(HttpMethod method, string path, StartedSession? who, object? body = null, string? idempotencyKey = null)
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(method, path, who?.AccessToken);
        if (method == HttpMethod.Post)
        {
            request.Headers.Add("Idempotency-Key", idempotencyKey ?? Guid.NewGuid().ToString("D"));
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds an upload with the multipart form the editor sends.</summary>
    public async Task<HttpResponseMessage> UploadAsync(UploadForm form, byte[]? file, StartedSession? who = null, string? idempotencyKey = null, string fileName = "photo.jpg")
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, Route, (who ?? Manager).AccessToken);
        request.Headers.Add("Idempotency-Key", idempotencyKey ?? Guid.NewGuid().ToString("D"));
        request.Content = MultipartBodies.Content("gallery-admin-boundary", Parts(form, file, fileName));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Replaces the photo of an upload.</summary>
    public async Task<HttpResponseMessage> ReplacePhotoAsync(Guid id, byte[]? file, StartedSession? who = null, string fileName = "photo.jpg")
    {
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/photo", (who ?? Manager).AccessToken);
        request.Headers.Add("Idempotency-Key", Guid.NewGuid().ToString("D"));
        List<MultipartPart> parts = [];
        if (file is not null)
        {
            parts.Add(MultipartPart.Upload("file", file, fileName));
        }

        request.Content = MultipartBodies.Content("gallery-admin-boundary", parts);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Edits an upload with the JSON form.</summary>
    public Task<HttpResponseMessage> UpdateAsync(Guid id, object body, StartedSession? who = null) =>
        SendAsync(HttpMethod.Put, $"{Route}/{id:D}", who ?? Manager, body);

    public Task<HttpResponseMessage> HideAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/hide", who ?? Manager);

    public Task<HttpResponseMessage> ShowAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/show", who ?? Manager);

    public Task<HttpResponseMessage> DeleteAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Delete, $"{Route}/{id:D}", who ?? Manager);

    public Task<HttpResponseMessage> MoveAsync(Guid id, string direction, Guid? lineId = null, StartedSession? who = null, string? idempotencyKey = null) =>
        SendAsync(HttpMethod.Post, $"{Route}/{id:D}/move", who ?? Manager, new { direction, lineId }, idempotencyKey);

    public Task<HttpResponseMessage> GetListAsync(string query = "", StartedSession? who = null) => SendAsync(HttpMethod.Get, $"{Route}{query}", who ?? Manager);

    public async Task<GalleryPage> ListAsync(string query = "")
    {
        using var response = await GetListAsync(query);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<GalleryPage>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    /// <summary>Adds an upload and returns its row, failing the test unless the answer is 201.</summary>
    public async Task<GalleryRow> AddAsync(UploadForm form, byte[]? file = null)
    {
        using var response = await UploadAsync(form, file ?? Csps.Testing.Images.SyntheticImages.Jpeg(800, 600));
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<GalleryRow>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    /// <summary>Adds a hidden product line with the given title (also its short name) and returns its id.</summary>
    public async Task<Guid> AddLineAsync(string title)
    {
        using var response = await SendAsync(HttpMethod.Post, "/api/v1/product-lines", Manager, LineBody.Shorts with { Title = title, ShortName = title });
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.GetProperty("id").GetGuid();
    }

    /// <summary>Deletes a product line through the Manager route.</summary>
    public Task<HttpResponseMessage> DeleteLineAsync(Guid id) => SendAsync(HttpMethod.Delete, $"/api/v1/product-lines/{id:D}", Manager);

    /// <summary>Reads the anonymous public gallery answer and its ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> PublicGalleryAsync()
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync(new Uri("/api/v1/public/gallery", UriKind.Relative), TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return (JsonDocument.Parse(text), response.Headers.ETag.ShouldNotBeNull().ToString());
    }

    private static List<MultipartPart> Parts(UploadForm form, byte[]? file, string fileName)
    {
        List<MultipartPart> parts = [];
        if (file is not null)
        {
            parts.Add(MultipartPart.Upload("file", file, fileName));
        }

        if (form.Team is not null)
        {
            parts.Add(MultipartPart.Text("teamName", form.Team));
        }

        if (form.LineId is { } line)
        {
            parts.Add(MultipartPart.Text("productLineId", line.ToString("D")));
        }

        if (form.Pieces is not null)
        {
            parts.Add(MultipartPart.Text("pieces", form.Pieces));
        }

        if (form.Note is not null)
        {
            parts.Add(MultipartPart.Text("note", form.Note));
        }

        if (form.IsShown is { } shown)
        {
            parts.Add(MultipartPart.Text("isShown", shown ? "true" : "false"));
        }

        return parts;
    }
}
