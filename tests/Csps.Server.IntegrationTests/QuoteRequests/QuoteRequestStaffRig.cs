using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Security;
using Csps.Domain.QuoteRequests;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>A request the staff tests save straight into the table.</summary>
/// <param name="Name">The visitor's name.</param>
/// <param name="Status">The status set after the save.</param>
/// <param name="ReceivedAt">The received time set after the save.</param>
/// <param name="Team">The team; none when null.</param>
/// <param name="Phone">The mobile number as typed.</param>
/// <param name="Email">The email; none when null.</param>
/// <param name="Choice">The product choice; none when null.</param>
/// <param name="LineId">The chosen line.</param>
/// <param name="Title">The line title.</param>
/// <param name="Quantity">The quantity range; none when null.</param>
/// <param name="Message">The message; none when null.</param>
/// <param name="PhotoNames">The declared photo file names; none when null.</param>
/// <param name="StoredSlots">The places whose photo arrived.</param>
internal sealed record QuoteSeed(
    string Name,
    QuoteRequestStatus Status,
    DateTimeOffset ReceivedAt,
    string? Team = null,
    string Phone = "0917 123 4567",
    string? Email = null,
    QuoteProductChoice? Choice = null,
    Guid? LineId = null,
    string? Title = null,
    QuoteQuantityRange? Quantity = null,
    string? Message = null,
    IReadOnlyList<string>? PhotoNames = null,
    IReadOnlyList<int>? StoredSlots = null);

/// <summary>A fresh database, a test host and a signed-in Admin for the staff quote request tests.</summary>
internal sealed class QuoteRequestStaffRig : IAsyncDisposable
{
    /// <summary>The staff route of the quote requests.</summary>
    public const string Route = "/api/v1/quote-requests";

    private readonly CspsDatabase _database;
    private readonly CspsApiFactory _base;

    private QuoteRequestStaffRig(CspsApiFactory baseFactory, WebApplicationFactory<Program> factory, CspsDatabase database, StartedSession admin)
    {
        _base = baseFactory;
        Factory = factory;
        _database = database;
        Client = factory.CreateClient();
        Admin = admin;
    }

    public WebApplicationFactory<Program> Factory { get; }

    public HttpClient Client { get; }

    public StartedSession Admin { get; }

    /// <summary>Resets the database and starts a host, optionally with test services in place of real ones.</summary>
    /// <param name="database">The class database.</param>
    /// <param name="configure">Builds the host from the base factory; the base factory when null.</param>
    /// <returns>The rig.</returns>
    public static async Task<QuoteRequestStaffRig> StartAsync(CspsDatabase database, Func<CspsApiFactory, WebApplicationFactory<Program>>? configure = null)
    {
        ArgumentNullException.ThrowIfNull(database);
        await database.ResetAsync();
        var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var host = configure is null ? baseFactory : configure(baseFactory);
        try
        {
            var admin = await TestSessions.StartAsync(host, Roles.Admin);
            return new QuoteRequestStaffRig(baseFactory, host, database, admin);
        }
        catch
        {
            await DisposeBothAsync(baseFactory, host);
            throw;
        }
    }

    /// <summary>The storage id the seed gives a stored photo; the testing delivery uses its last segment.</summary>
    /// <param name="requestId">The request.</param>
    /// <param name="slot">The place.</param>
    /// <returns>The public id.</returns>
    public static string PublicIdOf(Guid requestId, int slot) => $"csps-test/quotes/{requestId:D}/p{slot}{requestId:N}";

    public async Task<HttpResponseMessage> GetAsync(string? token, string path)
    {
        using var request = ApiRequests.Get(path, token);
        return await Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one request with the Admin and expects a 200.</summary>
    /// <param name="id">The request id.</param>
    /// <param name="token">The token; the Admin's when null.</param>
    /// <returns>The body.</returns>
    public async Task<JsonElement> ReadAsync(Guid id, string? token = null)
    {
        using var response = await GetAsync(token ?? Admin.AccessToken, $"{Route}/{id:D}");
        return await BodyAsync(response, System.Net.HttpStatusCode.OK);
    }

    /// <summary>Posts a status change with a fresh Idempotency-Key.</summary>
    /// <param name="token">The bearer token; none when null.</param>
    /// <param name="id">The request id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public async Task<HttpResponseMessage> PostStatusAsync(string? token, Guid id, object? body)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/status", token);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a note with a fresh Idempotency-Key.</summary>
    /// <param name="token">The bearer token; none when null.</param>
    /// <param name="id">The request id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public async Task<HttpResponseMessage> PostNoteAsync(string? token, Guid id, object? body)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/notes", token);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Deletes a request with a fresh Idempotency-Key.</summary>
    /// <param name="token">The bearer token; none when null.</param>
    /// <param name="id">The request id.</param>
    /// <param name="version">The version text; no query when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public async Task<HttpResponseMessage> DeleteAsync(string? token, Guid id, string? version)
    {
        var path = version is null ? $"{Route}/{id:D}" : $"{Route}/{id:D}?version={Uri.EscapeDataString(version)}";
        using var request = ApiRequests.Create(HttpMethod.Delete, path, token);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await Client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Checks the status code and returns the parsed body.</summary>
    /// <param name="response">The response.</param>
    /// <param name="expected">The status the test expects.</param>
    /// <returns>The body.</returns>
    public static async Task<JsonElement> BodyAsync(HttpResponseMessage response, System.Net.HttpStatusCode expected)
    {
        ArgumentNullException.ThrowIfNull(response);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(expected, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>
    /// Saves the request, then sets the received time and the status straight in the table, because the stamp on save writes the real
    /// clock. Each stored slot gets a 4000 x 3000 photo.
    /// </summary>
    /// <param name="seed">The request.</param>
    /// <returns>The new id.</returns>
    public async Task<Guid> SeedAsync(QuoteSeed seed)
    {
        ArgumentNullException.ThrowIfNull(seed);
        var id = Guid.CreateVersion7(seed.ReceivedAt);
        var input = new QuoteRequestInput(seed.Name, seed.Team, seed.Phone, seed.Email, seed.Choice, seed.LineId, seed.Title, seed.Quantity, seed.Message);
        var request = QuoteRequest.Receive(id, input, seed.ReceivedAt).Value;
        if (seed.PhotoNames is { Count: > 0 } names)
        {
            request.DeclarePhotos(names, new byte[QuoteRequestRules.UploadKeyHashLength], seed.ReceivedAt.AddHours(2)).IsSuccess.ShouldBeTrue();
        }

        var token = TestContext.Current.CancellationToken;
        await using var context = _database.CreateContext();
        context.QuoteRequests.Add(request);
        await context.SaveChangesAsync(token);
        await context.QuoteRequests
            .Where(row => row.Id == id)
            .ExecuteUpdateAsync(
                set => set
                    .SetProperty(row => row.CreatedAtUtc, seed.ReceivedAt)
                    .SetProperty(row => row.StatusChangedAtUtc, seed.ReceivedAt)
                    .SetProperty(row => row.Status, seed.Status),
                token);
        foreach (var slot in seed.StoredSlots ?? [])
        {
            var slotNumber = slot;
            var publicId = PublicIdOf(id, slotNumber);
            await context.QuoteRequestPhotos
                .Where(photo => photo.QuoteRequestId == id && photo.Slot == slotNumber)
                .ExecuteUpdateAsync(
                    set => set
                        .SetProperty(photo => photo.PublicId, publicId)
                        .SetProperty(photo => photo.Width, 4000)
                        .SetProperty(photo => photo.Height, 3000)
                        .SetProperty(photo => photo.Bytes, 120_000)
                        .SetProperty(photo => photo.Kind, "jpg")
                        .SetProperty(photo => photo.StoredAtUtc, seed.ReceivedAt.AddMinutes(1)),
                    token);
        }

        return id;
    }

    public async ValueTask DisposeAsync()
    {
        Client.Dispose();
        await DisposeBothAsync(_base, Factory);
    }

    private static async Task DisposeBothAsync(CspsApiFactory baseFactory, WebApplicationFactory<Program> host)
    {
        if (!ReferenceEquals(host, baseFactory))
        {
            await host.DisposeAsync();
        }

        await baseFactory.DisposeAsync();
    }
}
