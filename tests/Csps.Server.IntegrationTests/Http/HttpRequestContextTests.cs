using System.Net;
using System.Security.Claims;
using Csps.Application.Ports;
using Csps.Server.Composition;
using Csps.Server.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// FND-07 and research Pitfall 17: request facts reach Application code from the direct connection only. A spoofed
/// <c>X-Forwarded-For</c> is ignored until the FND-13 hosting record proves the proxy topology.
/// </summary>
public sealed class HttpRequestContextTests
{
    private const string TraceIdPattern = "^[0-9a-f]{32}$";

    [Fact]
    public void RemoteIpIgnoresForwardedFor()
    {
        var context = new DefaultHttpContext();
        context.Connection.RemoteIpAddress = IPAddress.Parse("10.0.0.5");
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";
        context.Request.Headers["X-Real-IP"] = "203.0.113.10";
        context.Request.Headers["CF-Connecting-IP"] = "203.0.113.11";

        For(context).RemoteIp.ShouldBe(IPAddress.Parse("10.0.0.5"));
    }

    [Fact]
    public void UserIdComesFromTheSubClaim()
    {
        var userId = Guid.NewGuid();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", userId.ToString())], "Test")),
        };

        For(context).UserId.ShouldBe(userId);
    }

    [Fact]
    public void UserIdIsNullWhenAnonymous() => For(new DefaultHttpContext()).UserId.ShouldBeNull();

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("")]
    public void UserIdIsNullWhenTheSubClaimIsMalformed(string subject)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", subject)], "Test")),
        };

        For(context).UserId.ShouldBeNull();
    }

    [Fact]
    public void SessionIdComesFromTheSidClaim()
    {
        var sessionId = Guid.NewGuid();
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(SecurityRegistration.SessionClaim, sessionId.ToString())], "Test")),
        };

        For(context).SessionId.ShouldBe(sessionId);
    }

    [Fact]
    public void SessionIdIsNullWithoutASidClaim()
    {
        For(new DefaultHttpContext()).SessionId.ShouldBeNull();
        For(new DefaultHttpContext { User = new ClaimsPrincipal(new ClaimsIdentity([new Claim("sub", Guid.NewGuid().ToString())], "Test")) })
            .SessionId.ShouldBeNull();
    }

    [Theory]
    [InlineData("not-a-guid")]
    [InlineData("")]
    public void SessionIdIsNullWhenTheSidClaimIsMalformed(string sid)
    {
        var context = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(SecurityRegistration.SessionClaim, sid)], "Test")),
        };

        For(context).SessionId.ShouldBeNull();
    }

    [Fact]
    public void UserAgentIsTheRawHeader()
    {
        const string UserAgent = "Mozilla/5.0 (Linux; Android 14) CspsTest/1.0";
        var context = new DefaultHttpContext();
        context.Request.Headers.UserAgent = UserAgent;

        For(context).UserAgent.ShouldBe(UserAgent);
    }

    [Fact]
    public void UserAgentIsNullWhenAbsent() => For(new DefaultHttpContext()).UserAgent.ShouldBeNull();

    [Fact]
    public void CorrelationIdIsTheResponseTraceId()
    {
        var context = new DefaultHttpContext();

        For(context).CorrelationId.ShouldBe(CorrelationId.For(context));
    }

    [Fact]
    public void WithoutARequestFactsAreAbsentAndTheIdIsHex()
    {
        var requestContext = new HttpRequestContext(new HttpContextAccessor());

        requestContext.UserId.ShouldBeNull();
        requestContext.SessionId.ShouldBeNull();
        requestContext.RemoteIp.ShouldBeNull();
        requestContext.UserAgent.ShouldBeNull();
        requestContext.CorrelationId.ShouldMatch(TraceIdPattern);
        requestContext.CorrelationId.ShouldBe(requestContext.CorrelationId, "the id stays the same for one unit of work");
    }

    [Fact]
    public async Task PipelineResolvesRequestContextFromTheConnection()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
            builder.ConfigureTestServices(services => services.AddTransient<IStartupFilter, RequestContextEchoFilter>()));
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(RequestContextEchoFilter.Path, UriKind.Relative));
        request.Headers.Add("X-Forwarded-For", "203.0.113.9");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldBe($"{RequestContextEchoFilter.ConnectionIp}|{RequestContextEchoFilter.UserAgentMarker}|hex");
    }

    private static HttpRequestContext For(HttpContext context) => new(new HttpContextAccessor { HttpContext = context });

    /// <summary>
    /// Sets a known connection address, then answers one test-only path with what the registered
    /// <see cref="IRequestContext"/> reports.
    /// </summary>
    private sealed class RequestContextEchoFilter : IStartupFilter
    {
        public const string Path = "/test-only/request-context";
        public const string ConnectionIp = "10.0.0.5";
        public const string UserAgentMarker = "no-user-agent";

        public Action<IApplicationBuilder> Configure(Action<IApplicationBuilder> next) => app =>
        {
            app.Use((context, nextMiddleware) =>
            {
                if (!context.Request.Path.StartsWithSegments(Path, StringComparison.Ordinal))
                {
                    return nextMiddleware(context);
                }

                context.Connection.RemoteIpAddress = IPAddress.Parse(ConnectionIp);
                var requestContext = context.RequestServices.GetRequiredService<IRequestContext>();
                var correlation = requestContext.CorrelationId is { Length: 32 } id && id.All(char.IsAsciiHexDigitLower) ? "hex" : requestContext.CorrelationId;
                return context.Response.WriteAsync(
                    $"{requestContext.RemoteIp}|{requestContext.UserAgent ?? UserAgentMarker}|{correlation}",
                    context.RequestAborted);
            });
            next(app);
        };
    }
}
