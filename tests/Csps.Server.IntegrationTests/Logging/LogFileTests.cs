using System.Globalization;
using System.Net;
using System.Text.Json;
using Csps.Server.IntegrationTests.Http;
using Csps.Server.Logging;
using Csps.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using Serilog.Formatting.Compact;

namespace Csps.Server.IntegrationTests.Logging;

/// <summary>
/// D-21 and FND-07: logs are compact JSON files under <c>{contentRoot}/logs</c> with a daily roll and bounded
/// retention, and no log line carries the client's IP address or raw User-Agent (RA 10173 data minimization).
/// </summary>
public sealed class LogFileTests
{
    private const string ClientIp = "203.0.113.45";
    private const string ClientUserAgent = "CspsTestAgent/1.0";

    [Fact]
    public void LogFileSettingsHasD21Values()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), "site");

        var settings = LogFileSettings.For(contentRoot);

        settings.Path.ShouldBe(Path.Combine(contentRoot, "logs", "csps-.json"));
        settings.RollingInterval.ShouldBe(RollingInterval.Day);
        settings.RetainedFileCountLimit.ShouldBe(30);
        settings.RetainedFileTimeLimit.ShouldBe(TimeSpan.FromDays(30));
        settings.FileSizeLimitBytes.ShouldBe(10_485_760);
        settings.RollOnFileSizeLimit.ShouldBeTrue();
        settings.Shared.ShouldBeTrue();
        settings.FlushToDiskInterval.ShouldBe(TimeSpan.FromSeconds(2));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("relative/site")]
    public void LogFileSettingsRequiresAnAbsoluteContentRoot(string contentRoot) =>
        Should.Throw<ArgumentException>(() => LogFileSettings.For(contentRoot));

    [Fact]
    public async Task WritesCompactJsonUnderContentRoot()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), $"csps-logtest-{Guid.NewGuid():N}");
        Directory.CreateDirectory(contentRoot);
        try
        {
            string traceId;
            await using (var baseFactory = new CspsApiFactory())
            await using (var factory = baseFactory.WithWebHostBuilder(builder => builder
                .UseContentRoot(contentRoot)
                .UseSetting(CspsApiFactory.LogFileSwitchKey, "true")))
            {
                using var client = factory.CreateClient();
                using var response = await client.GetAsync(new Uri("/api/v1/nope", UriKind.Relative), TestContext.Current.CancellationToken);
                response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
                traceId = ProblemJson.TraceId(await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken));
                await LogEvents.RequestCompletionAsync(baseFactory.Sink, "/api/v1/nope", TestContext.Current.CancellationToken);
            }

            var logDirectory = Path.Combine(contentRoot, "logs");
            Directory.Exists(logDirectory).ShouldBeTrue("the file sink writes under {contentRoot}/logs");
            var file = Directory.GetFiles(logDirectory).ShouldHaveSingleItem();
            Path.GetFileName(file).ShouldMatch(@"^csps-\d{8}\.json$");
            var lines = await File.ReadAllLinesAsync(file, TestContext.Current.CancellationToken);
            lines.ShouldNotBeEmpty();
            foreach (var line in lines)
            {
                using var document = JsonDocument.Parse(line);
                document.RootElement.TryGetProperty("@t", out _).ShouldBeTrue("every line is one compact JSON event");
            }

            lines.ShouldContain(line => line.Contains($"\"@tr\":\"{traceId}\"", StringComparison.Ordinal));
        }
        finally
        {
            Directory.Delete(contentRoot, recursive: true);
        }
    }

    [Fact]
    public async Task LogsNeverContainClientIpOrUserAgent()
    {
        const string RequestPath = "/api/v1/nope";
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddTransient<IStartupFilter, ClientAddressFilter>()));
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.UserAgent.ParseAdd(ClientUserAgent);

        using var response = await client.GetAsync(new Uri(RequestPath, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        response.Headers.GetValues(ClientAddressFilter.EchoHeader).ShouldHaveSingleItem().ShouldBe(ClientIp);
        await LogEvents.RequestCompletionAsync(baseFactory.Sink, RequestPath, TestContext.Current.CancellationToken);
        var formatter = new CompactJsonFormatter();
        foreach (var logEvent in baseFactory.Sink.Events)
        {
            using var writer = new StringWriter(CultureInfo.InvariantCulture);
            formatter.Format(logEvent, writer);
            var line = writer.ToString();
            line.ShouldNotContain(ClientIp);
            line.ShouldNotContain(ClientUserAgent);
            logEvent.RenderMessage(CultureInfo.InvariantCulture).ShouldNotContain(ClientIp);
        }
    }

    /// <summary>
    /// Gives every request a known remote address before the real pipeline runs, and echoes it back in a header so
    /// the test can prove the address was present while the request was logged.
    /// </summary>
    private sealed class ClientAddressFilter : IStartupFilter
    {
        public const string EchoHeader = "X-Test-Remote-Ip";

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                context.Connection.RemoteIpAddress = IPAddress.Parse(ClientIp);
                context.Response.Headers[EchoHeader] = ClientIp;
                return nextMiddleware(context);
            });
            next(app);
        };
    }
}
