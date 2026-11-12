using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>What a test sends to add or edit a product line. Null members are left out of the meaning, so the validator reports them.</summary>
internal sealed record LineBody(
    string? Title,
    string? ShortName,
    string? Number,
    string? CardText,
    string? Description,
    string? FabricText,
    string? CollarText,
    string? CutText,
    string? NamesText,
    string? LogosText,
    decimal? StartsAtPrice,
    decimal? MinimumQuantity,
    bool? IsActive,
    Guid[]? ProductTypeIds,
    string? Version)
{
    /// <summary>A complete, valid form for a new line called Shorts.</summary>
    public static LineBody Shorts { get; } = new(
        "Shorts",
        "Shorts",
        "7",
        "Light sample shorts for the sample team.",
        "Sample shorts printed edge to edge in any colorway.",
        "Sample mesh fabric",
        "No collar",
        "Standard fit",
        "Any font on the leg",
        "Team crest on the hem",
        null,
        null,
        false,
        null,
        null);
}

/// <summary>One line as the Manager's detail read returns it.</summary>
internal sealed record LineDetail(
    Guid Id,
    string Key,
    string Title,
    string ShortName,
    string Number,
    string CardText,
    string Description,
    string FabricText,
    string CollarText,
    string CutText,
    string NamesText,
    string LogosText,
    decimal? StartsAtPrice,
    int? MinimumQuantity,
    bool IsActive,
    int Position,
    string PlaceholderArt,
    Guid[] ProductTypeIds,
    string Version,
    string? UpdatedByName,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? UpdatedAtUtc)
{
    /// <summary>Turns the detail back into a form that changes nothing, carrying the version.</summary>
    /// <returns>The form.</returns>
    public LineBody ToBody() => new(
        Title, ShortName, Number, CardText, Description, FabricText, CollarText, CutText, NamesText, LogosText,
        StartsAtPrice, MinimumQuantity, IsActive, ProductTypeIds, Version);
}

/// <summary>One row of the Manager's list.</summary>
internal sealed record LineListItem(
    Guid Id,
    string Key,
    string Title,
    string ShortName,
    decimal? StartsAtPrice,
    int? MinimumQuantity,
    bool IsActive,
    int Position,
    string? MainPhotoThumb,
    Guid[] ProductTypeIds,
    int ShownGalleryCount,
    int PhotoCount,
    bool CanDelete,
    string Version);

/// <summary>A host, a Manager and the calls the product line tests make. The six migrated lines are put back first.</summary>
internal sealed class ProductLineRig : IAsyncDisposable
{
    public const string Route = "/api/v1/product-lines";

    private ProductLineRig(CspsDatabase database, WebApplicationFactory<Program> factory, StartedSession manager)
    {
        Database = database;
        Factory = factory;
        Manager = manager;
    }

    public CspsDatabase Database { get; }

    public WebApplicationFactory<Program> Factory { get; }

    public StartedSession Manager { get; }

    public static async Task<ProductLineRig> StartAsync(CspsDatabase database)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        return new ProductLineRig(database, factory, await TestSessions.StartAsync(factory, Roles.Manager));
    }

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

    public Task<HttpResponseMessage> GetListAsync(StartedSession? who = null) => SendAsync(HttpMethod.Get, Route, who ?? Manager);

    public Task<HttpResponseMessage> GetOneAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Get, $"{Route}/{id:D}", who ?? Manager);

    public Task<HttpResponseMessage> PostAsync(LineBody body, StartedSession? who = null) => SendAsync(HttpMethod.Post, Route, who ?? Manager, body);

    public Task<HttpResponseMessage> PutAsync(Guid id, LineBody body, StartedSession? who = null) => SendAsync(HttpMethod.Put, $"{Route}/{id:D}", who ?? Manager, body);

    public Task<HttpResponseMessage> MoveAsync(Guid id, string direction, StartedSession? who = null, string? idempotencyKey = null) =>
        SendAsync(HttpMethod.Post, $"{Route}/{id:D}/move", who ?? Manager, new { direction }, idempotencyKey);

    public Task<HttpResponseMessage> HideAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/hide", who ?? Manager);

    public Task<HttpResponseMessage> ShowAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/show", who ?? Manager);

    public Task<HttpResponseMessage> DeleteAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Delete, $"{Route}/{id:D}", who ?? Manager);

    /// <summary>Uploads a file as one photo slot of a line with the multipart form the editor sends.</summary>
    public async Task<HttpResponseMessage> UploadPhotoAsync(Guid id, string slot, byte[] file, StartedSession? who = null, string? idempotencyKey = null, string fileName = "photo.jpg")
    {
        const string boundary = "csps-line-photo-boundary";
        using var client = Factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/photos/{slot}", (who ?? Manager).AccessToken);
        request.Headers.Add("Idempotency-Key", idempotencyKey ?? Guid.NewGuid().ToString("D"));
        using var content = new ByteArrayContent(MultipartBodies.Build(boundary, [MultipartPart.Upload("file", file, fileName)]));
        content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("multipart/form-data") { Parameters = { new System.Net.Http.Headers.NameValueHeaderValue("boundary", boundary) } };
        request.Content = content;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    public Task<HttpResponseMessage> RemovePhotoAsync(Guid id, string slot, StartedSession? who = null) =>
        SendAsync(HttpMethod.Delete, $"{Route}/{id:D}/photos/{slot}", who ?? Manager);

    public async Task<List<LineListItem>> ListAsync()
    {
        using var response = await GetListAsync();
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<List<LineListItem>>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    public async Task<LineDetail> DetailAsync(Guid id)
    {
        using var response = await GetOneAsync(id);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<LineDetail>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    public async Task<LineDetail> AddAsync(LineBody body)
    {
        using var response = await PostAsync(body);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<LineDetail>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    /// <summary>Reads the anonymous public lines answer: the keys in order and the ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> PublicLinesAsync()
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync(new Uri("/api/v1/public/product-lines", UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (document, response.Headers.ETag.ShouldNotBeNull().ToString());
    }

    public async Task<string[]> PublicKeysAsync()
    {
        var (document, _) = await PublicLinesAsync();
        using (document)
        {
            return [.. document.RootElement.GetProperty("lines").EnumerateArray().Select(line => line.GetProperty("key").GetString()!)];
        }
    }

    public async Task<Guid> ProductTypeIdAsync(string name)
    {
        await using var context = Database.CreateContext();
        return await context.ProductTypes.AsNoTracking().Where(type => type.Name == name).Select(type => type.Id).SingleAsync(TestContext.Current.CancellationToken);
    }

    public async Task<Guid?> LinkedLineOfAsync(Guid productTypeId)
    {
        await using var context = Database.CreateContext();
        return await context.ProductTypes.AsNoTracking().Where(type => type.Id == productTypeId).Select(type => type.ProductLineId).SingleAsync(TestContext.Current.CancellationToken);
    }
}
