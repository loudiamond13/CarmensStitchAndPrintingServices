using System.Net;
using System.Text.Json;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Health;

public sealed class HealthEndpointTests(CspsApiFactory factory) : IClassFixture<CspsApiFactory>
{
    private const string ExpectedBody = """{"status":"Healthy","checks":[{"name":"self","status":"Healthy"}]}""";

    [Fact]
    public async Task ReturnsHealthyLivenessJson()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldBe(ExpectedBody);
    }

    [Fact]
    public async Task IsNotCacheable()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
    }

    [Fact]
    public async Task ExposesNoInternals()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(body);
        var keys = CollectPropertyNames(document.RootElement);
        string[] forbidden = ["duration", "description", "exception", "data", "version"];
        foreach (var name in forbidden)
        {
            keys.ShouldNotContain(key => string.Equals(key, name, StringComparison.OrdinalIgnoreCase));
        }
    }

    private static List<string> CollectPropertyNames(JsonElement element)
    {
        var names = new List<string>();
        Collect(element, names);
        return names;

        static void Collect(JsonElement current, List<string> sink)
        {
            switch (current.ValueKind)
            {
                case JsonValueKind.Object:
                    foreach (var property in current.EnumerateObject())
                    {
                        sink.Add(property.Name);
                        Collect(property.Value, sink);
                    }

                    break;
                case JsonValueKind.Array:
                    foreach (var item in current.EnumerateArray())
                    {
                        Collect(item, sink);
                    }

                    break;
                default:
                    break;
            }
        }
    }
}
