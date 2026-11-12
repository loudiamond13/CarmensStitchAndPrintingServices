using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>What a test sends to add or edit a testimonial. Null members are left out of the meaning, so the validator reports them.</summary>
internal sealed record TestimonialBody(string? Quote, string? Name, string? TeamOrRole, decimal? Stars, bool? IsShown, string? Version)
{
    /// <summary>A complete, valid form for the first demo testimonial, shown.</summary>
    public static TestimonialBody Juan { get; } = new(
        "Seventeen pieces, names and numbers perfect.",
        "Juan Dela Cruz",
        "Captain, Brgy. Sample Ballers",
        5,
        true,
        null);

    /// <summary>Makes a valid shown testimonial with its own name and quote.</summary>
    public static TestimonialBody Named(string name, string quote, bool shown = true) => new(quote, name, null, 4, shown, null);
}

/// <summary>One testimonial as the Manager's list returns it.</summary>
internal sealed record TestimonialItem(Guid Id, string Quote, string Name, string? TeamOrRole, int Stars, int Position, bool IsShown, string Version)
{
    /// <summary>Turns the item back into a form that changes nothing, carrying the version.</summary>
    public TestimonialBody ToBody() => new(Quote, Name, TeamOrRole, Stars, IsShown, Version);
}

/// <summary>A host, a Manager and the calls the testimonial tests make. The six migrated lines are put back first and no testimonial exists.</summary>
internal sealed class TestimonialRig : IAsyncDisposable
{
    public const string Route = "/api/v1/testimonials";

    private TestimonialRig(CspsDatabase database, WebApplicationFactory<Program> factory, StartedSession manager)
    {
        Database = database;
        Factory = factory;
        Manager = manager;
    }

    public CspsDatabase Database { get; }

    public WebApplicationFactory<Program> Factory { get; }

    public StartedSession Manager { get; }

    public static async Task<TestimonialRig> StartAsync(CspsDatabase database)
    {
        await database.ResetAsync();
        await ProductLineSeeding.RestoreSixAsync(database);
        var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        return new TestimonialRig(database, factory, await TestSessions.StartAsync(factory, Roles.Manager));
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

    public Task<HttpResponseMessage> PostAsync(TestimonialBody body, StartedSession? who = null) => SendAsync(HttpMethod.Post, Route, who ?? Manager, body);

    public Task<HttpResponseMessage> PutAsync(Guid id, TestimonialBody body, StartedSession? who = null) => SendAsync(HttpMethod.Put, $"{Route}/{id:D}", who ?? Manager, body);

    public Task<HttpResponseMessage> MoveAsync(Guid id, string direction, StartedSession? who = null, string? idempotencyKey = null) =>
        SendAsync(HttpMethod.Post, $"{Route}/{id:D}/move", who ?? Manager, new { direction }, idempotencyKey);

    public Task<HttpResponseMessage> HideAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/hide", who ?? Manager);

    public Task<HttpResponseMessage> ShowAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Post, $"{Route}/{id:D}/show", who ?? Manager);

    public Task<HttpResponseMessage> DeleteAsync(Guid id, StartedSession? who = null) => SendAsync(HttpMethod.Delete, $"{Route}/{id:D}", who ?? Manager);

    public async Task<List<TestimonialItem>> ListAsync()
    {
        using var response = await GetListAsync();
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<List<TestimonialItem>>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    public async Task<TestimonialItem> AddAsync(TestimonialBody body)
    {
        using var response = await PostAsync(body);
        response.StatusCode.ShouldBe(HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<TestimonialItem>(JsonSerializerOptions.Web, TestContext.Current.CancellationToken))!;
    }

    /// <summary>Reads the anonymous public Home answer and its ETag.</summary>
    public async Task<(JsonDocument Document, string ETag)> PublicHomeAsync()
    {
        using var client = Factory.CreateClient();
        using var response = await client.GetAsync(new Uri("/api/v1/public/home", UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (document, response.Headers.ETag.ShouldNotBeNull().ToString());
    }

    /// <summary>Reads the names of the testimonials the public Home answer shows, in order.</summary>
    public async Task<string[]> PublicNamesAsync()
    {
        var (document, _) = await PublicHomeAsync();
        using (document)
        {
            return [.. document.RootElement.GetProperty("testimonials").EnumerateArray().Select(item => item.GetProperty("name").GetString()!)];
        }
    }
}
