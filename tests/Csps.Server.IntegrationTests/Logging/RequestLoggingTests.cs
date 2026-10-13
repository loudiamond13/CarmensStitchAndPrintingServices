using System.Globalization;
using System.Net;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Logging;

/// <summary>
/// FND-07: every request writes one Serilog request-completion event whose trace id is the <c>traceId</c> the
/// client sees in the ProblemDetails, so support staff can find a reported request in the logs.
/// </summary>
public sealed class RequestLoggingTests
{
    [Fact]
    public async Task RequestEventTraceIdMatchesProblemTraceId()
    {
        const string Path = "/api/v1/nope";
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        var traceId = ProblemJson.TraceId(problem);

        var logEvent = await LogEvents.RequestCompletionAsync(factory.Sink, Path, TestContext.Current.CancellationToken);
        Convert.ToInt32(LogEvents.Scalar(logEvent, "StatusCode"), CultureInfo.InvariantCulture).ShouldBe(404);
        logEvent.TraceId.ShouldNotBeNull("the request event must carry the W3C trace id").ToHexString().ShouldBe(traceId);
    }

    // Static files end the pipeline without calling the next middleware, so request logging must run before them or
    // asset traffic (including scanners probing real files) never reaches the log (NET-WR-04).
    [Theory]
    [InlineData("/assets/app-fixture.js")]
    [InlineData("/robots.txt")]
    public async Task AStaticFileRequestWritesItsCompletionEvent(string path)
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var logEvent = await LogEvents.RequestCompletionAsync(factory.Sink, path, TestContext.Current.CancellationToken);
        Convert.ToInt32(LogEvents.Scalar(logEvent, "StatusCode"), CultureInfo.InvariantCulture).ShouldBe(200);
        logEvent.TraceId.ShouldNotBeNull("the request event must carry the W3C trace id");
    }

    [Fact]
    public async Task ParallelRequestsKeepTheirOwnIds()
    {
        const int RequestCount = 10;
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        var results = await Task.WhenAll(Enumerable.Range(0, RequestCount).Select(async index =>
        {
            var path = $"/api/v1/nope-{index.ToString(CultureInfo.InvariantCulture)}";
            using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
            response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
            var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
            return (Path: path, TraceId: ProblemJson.TraceId(problem));
        }));

        foreach (var (path, traceId) in results)
        {
            var logEvent = await LogEvents.RequestCompletionAsync(factory.Sink, path, TestContext.Current.CancellationToken);
            logEvent.TraceId.ShouldNotBeNull($"the event for {path} must carry its trace id").ToHexString().ShouldBe(traceId);
        }

        results.Select(static result => result.TraceId).Distinct(StringComparer.Ordinal).Count().ShouldBe(RequestCount);
    }
}
