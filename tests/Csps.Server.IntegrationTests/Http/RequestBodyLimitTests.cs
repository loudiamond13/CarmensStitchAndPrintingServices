using System.Net;
using Csps.Server.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>SEC-03, T-04-18: a request body above 1 MB is refused with a 413 before routing; exactly 1 MB passes.</summary>
public sealed class RequestBodyLimitTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const int Limit = 1_048_576;
    private const string Route = "/api/v1/does-not-exist";

    [Fact]
    public void TheLimitIsOneMebibyte() => RequestBodyLimitMiddleware.MaxBytes.ShouldBe(Limit);

    [Fact]
    public async Task OneByteOverTheLimitIsRefusedAs413Problem()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new ByteArrayContent(new byte[Limit + 1]);

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.RequestEntityTooLarge);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(413);
        problem.GetProperty("title").GetString().ShouldBe("The request is too large.");
        ProblemJson.TraceId(problem);
    }

    [Fact]
    public async Task ExactlyTheLimitReachesRouting()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new ByteArrayContent(new byte[Limit]);

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ARequestWithoutABodyIsUnaffected()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task ServerFeatureLimitIsSetForBodiesWithoutALength()
    {
        var feature = new FakeMaxBodyFeature();
        var context = ContextWith(feature);
        var called = false;

        await new RequestBodyLimitMiddleware(_ => { called = true; return Task.CompletedTask; }).InvokeAsync(context);

        called.ShouldBeTrue();
        feature.MaxRequestBodySize.ShouldBe(Limit);
    }

    [Fact]
    public async Task AReadOnlyServerFeatureIsLeftAlone()
    {
        var feature = new FakeMaxBodyFeature { IsReadOnly = true, MaxRequestBodySize = 5 };
        var context = ContextWith(feature);

        await new RequestBodyLimitMiddleware(static _ => Task.CompletedTask).InvokeAsync(context);

        feature.MaxRequestBodySize.ShouldBe(5);
    }

    [Fact]
    public async Task AHostWithoutTheFeatureStillRunsTheRequest()
    {
        var context = new DefaultHttpContext();
        var called = false;

        await new RequestBodyLimitMiddleware(_ => { called = true; return Task.CompletedTask; }).InvokeAsync(context);

        called.ShouldBeTrue();
    }

    private static DefaultHttpContext ContextWith(FakeMaxBodyFeature feature)
    {
        var context = new DefaultHttpContext();
        context.Features.Set<IHttpMaxRequestBodySizeFeature>(feature);
        return context;
    }

    private sealed class FakeMaxBodyFeature : IHttpMaxRequestBodySizeFeature
    {
        public bool IsReadOnly { get; init; }

        public long? MaxRequestBodySize { get; set; }
    }
}
