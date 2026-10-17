using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Csps.HostProbe.Tests;

public sealed class HostFactsJsonTests
{
    [Fact]
    public void CollectReportsTheCertificateAttemptsAsJson()
    {
        var root = Path.Combine(Path.GetTempPath(), "csps-hostprobe-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(root);
        try
        {
            var facts = HostFacts.Collect(new DefaultHttpContext(), new TestEnvironment(root), TimeProvider.System);

            using var document = JsonDocument.Parse(JsonSerializer.Serialize(facts, JsonSerializerOptions.Web));
            var json = document.RootElement;

            json.TryGetProperty("ephemeralPfxRoundTrip", out _).ShouldBeFalse();
            var attempts = json.GetProperty("certificateRoundTrips");
            attempts.ValueKind.ShouldBe(JsonValueKind.Array);

            var first = attempts[0];
            first.GetProperty("name").GetString().ShouldBe("ephemeral");
            first.GetProperty("ok").GetBoolean().ShouldBeTrue();
            first.GetProperty("step").ValueKind.ShouldBe(JsonValueKind.Null);
            first.GetProperty("exceptionType").ValueKind.ShouldBe(JsonValueKind.Null);
            first.GetProperty("hResult").ValueKind.ShouldBe(JsonValueKind.Null);
            first.GetProperty("message").ValueKind.ShouldBe(JsonValueKind.Null);
            first.GetProperty("keyCleanup").GetString().ShouldBe("none");
        }
        finally
        {
            Directory.Delete(root, recursive: true);
        }
    }

    private sealed class TestEnvironment(string contentRoot) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Production;

        public string ApplicationName { get; set; } = "Csps.HostProbe.Tests";

        public string ContentRootPath { get; set; } = contentRoot;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
