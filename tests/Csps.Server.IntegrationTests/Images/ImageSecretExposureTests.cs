using System.Globalization;
using System.Net;
using System.Text;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.IntegrationTests.Orders;
using Csps.Testing;
using Csps.Testing.Images;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Serilog.Events;

namespace Csps.Server.IntegrationTests.Images;

/// <summary>
/// IMG-01, D-06, D-07: with the real Cloudinary adapter and a stand-in for Cloudinary's servers, no answer and no log line holds the
/// API secret or the API key. Fake values only; no test reaches the network.
/// </summary>
public sealed class ImageSecretExposureTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string FakeSecret = "test-secret-not-real";
    private const string FakeKey = "000000000000000";
    private const string UploadedJson = """{"public_id":"csps-dev/orders/x/y","version":1,"resource_type":"image","type":"private"}""";

    [Fact]
    public async Task NoAnswerHeaderOrLogLineHoldsTheCloudinaryKeyOrSecret()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var baseClient = baseFactory.CreateClient();
        var manager = await TestSessions.StartAsync(baseFactory, Roles.Manager);
        var today = await OrderFixtures.TodayAsync(baseFactory);
        var created = await OrderFixtures.CreateAsync(baseClient, manager.AccessToken, OrderFixtures.ValidBody(OrderFixtures.BasketballId, today));
        var orderId = created.GetProperty("id").GetGuid();
        var cloudinary = new FakeCloudinary();
        await using var development = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Development);
            builder.UseSetting("Cloudinary:CloudName", "demo-cloud");
            builder.UseSetting("Cloudinary:ApiKey", FakeKey);
            builder.UseSetting("Cloudinary:ApiSecret", FakeSecret);
            builder.ConfigureTestServices(services => services.AddHttpClient("cloudinary").ConfigurePrimaryHttpMessageHandler(() => cloudinary));
        });
        using var client = development.CreateClient();
        var seen = new StringBuilder();

        using (var stored = await UploadAsync(client, manager.AccessToken, orderId))
        {
            stored.StatusCode.ShouldBe(HttpStatusCode.OK);
            seen.Append(await Describe(stored));
        }

        cloudinary.Requests.ShouldBe(1, "the real adapter must have sent the upload to the stand-in");
        cloudinary.RefuseNext = true;
        using (var refused = await UploadAsync(client, manager.AccessToken, orderId))
        {
            refused.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
            seen.Append(await Describe(refused));
        }

        foreach (var path in new[] { $"/api/v1/orders/{orderId:D}", "/api/v1/orders", "/api/v1/orders/image-rules" })
        {
            using var request = ApiRequests.Get(path, manager.AccessToken);
            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.OK, path);
            seen.Append(await Describe(response));
        }

        seen.ToString().ShouldNotContain(FakeSecret);
        seen.ToString().ShouldNotContain(FakeKey);
        var logs = string.Join('\n', baseFactory.Sink.Events.Select(Render));
        logs.ShouldNotContain(FakeSecret);
        logs.ShouldNotContain(FakeKey);
    }

    private static string Render(LogEvent logEvent) =>
        logEvent.RenderMessage(CultureInfo.InvariantCulture) + " " + string.Join(' ', logEvent.Properties.Select(property => property.Value.ToString()));

    private static async Task<string> Describe(HttpResponseMessage response)
    {
        var headers = string.Join('\n', response.Headers.Concat(response.Content.Headers).Select(header => $"{header.Key}: {string.Join(',', header.Value)}"));
        return headers + "\n" + await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> UploadAsync(HttpClient client, string accessToken, Guid orderId)
    {
        using var request = ApiRequests.Create(HttpMethod.Post, $"/api/v1/orders/{orderId:D}/images", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        using var form = new MultipartFormDataContent();
        var part = new ByteArrayContent(SyntheticImages.Jpeg(800, 600));
        part.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("image/jpeg");
        form.Add(part, "file", "photo.jpg");
        request.Content = form;
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    private sealed class FakeCloudinary : HttpMessageHandler
    {
        private int _requests;

        public int Requests => _requests;

        public bool RefuseNext { get; set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Interlocked.Increment(ref _requests);
            var refuse = RefuseNext;
            RefuseNext = false;
            var response = refuse
                ? new HttpResponseMessage(HttpStatusCode.Unauthorized) { Content = new StringContent("""{"error":{"message":"Invalid api_key"}}""", Encoding.UTF8, "application/json") }
                : new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(UploadedJson, Encoding.UTF8, "application/json") };
            return Task.FromResult(response);
        }
    }
}
