using System.Net;
using Csps.Application.Content;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Server.IntegrationTests.Authorization;

/// <summary>
/// FND-05, SEC-01, SEC-02, D-27, T-01-30: every authorization failure is a ProblemDetails with the full header set and
/// no internals, rejected tokens never get through, and the API refuses to start without valid JWT settings. None of
/// these requests reaches the database, so the parameterless factory (an unopened test database name) is enough.
/// </summary>
public sealed class AuthorizationFailureTests
{
    private const string SiteSettingsRoute = "/api/v1/site-settings";
    private const string SecretText = "db password=hunter2";

    [Fact]
    public async Task UnknownRoleGets403Problem()
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(SiteSettingsRoute, TestTokens.For("Customer", TimeProvider.System));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(403);
        problem.GetProperty("title").GetString().ShouldBe("You don't have access to this.");
        ProblemJson.TraceId(problem);
    }

    [Theory]
    [InlineData("expired")]
    [InlineData("signed-with-another-key")]
    [InlineData("unsigned")]
    [InlineData("wrong-issuer")]
    [InlineData("wrong-audience")]
    public async Task ExpiredOrForeignTokensGet401(string kind)
    {
        var token = kind switch
        {
            "expired" => TestTokens.Expired(Roles.Manager),
            "signed-with-another-key" => TestTokens.SignedWithOtherKey(Roles.Manager),
            "unsigned" => TestTokens.WithoutSignature(Roles.Manager),
            "wrong-issuer" => TestTokens.WithIssuerAndAudience(Roles.Manager, "someone-else", TestJwt.Audience),
            "wrong-audience" => TestTokens.WithIssuerAndAudience(Roles.Manager, TestJwt.Issuer, "another-api"),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Unknown token kind."),
        };
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(SiteSettingsRoute, token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe("Please sign in to continue.");
        ProblemJson.TraceId(problem);

        // The challenge never explains why the token failed (CWE-209).
        response.Headers.WwwAuthenticate.ShouldHaveSingleItem().ToString().ShouldBe("Bearer");
    }

    [Theory]
    [InlineData(10, HttpStatusCode.OK)]
    [InlineData(60, HttpStatusCode.Unauthorized)]
    public async Task ClockSkewIsThirtySeconds(int expiredSecondsAgo, HttpStatusCode expected)
    {
        // A token that expired within the 30-second skew is still signed in, so the Staff-only route answers 200. The
        // reader is an in-memory stub, so no database is needed. (Phase 1 probed an unknown page path, which Phase 2
        // now serves to everyone as the SPA shell, WEB-01.)
        var issuedAt = new FakeTimeProvider(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        var token = TestTokens.For(Roles.Manager, issuedAt, lifetime: TimeSpan.FromMinutes(5) - TimeSpan.FromSeconds(expiredSecondsAgo));
        await using var baseFactory = new CspsApiFactory();
        await using var factory = WithFixedReader(baseFactory);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(SiteSettingsRoute, token);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(expected);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.Unauthorized, "Please sign in to continue.")]
    [InlineData("Customer", HttpStatusCode.Forbidden, "You don't have access to this.")]
    public async Task HtmlAcceptStillProblemJson(string? role, HttpStatusCode expected, string title)
    {
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        var token = role is null ? null : TestTokens.For(role, TimeProvider.System);
        using var request = ApiRequests.Get(SiteSettingsRoute, token, accept: "text/html");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(expected);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe(title);
        ProblemJson.TraceId(problem);
    }

    [Fact]
    public async Task HandlerExceptionIs500WithReference()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = ProductionWithThrowingReader(baseFactory);
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(SiteSettingsRoute, TestTokens.For(Roles.Manager, TimeProvider.System));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.InternalServerError);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.ShouldNotContain("hunter2");
        body.ShouldNotContain("InvalidOperationException");
        body.ShouldNotContain("Exception", Case.Insensitive);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        var traceId = ProblemJson.TraceId(problem);
        problem.GetProperty("title").GetString().ShouldBe("Something went wrong.");
        problem.GetProperty("detail").GetString().ShouldBe($"Something went wrong. Reference: {traceId}");
    }

    [Theory]
    [InlineData(401)]
    [InlineData(403)]
    [InlineData(404)]
    [InlineData(500)]
    [InlineData(503)]
    public async Task ErrorResponsesCarryHeaders(int status)
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = status == 500 ? ProductionWithThrowingReader(baseFactory) : baseFactory;
        using var client = factory.CreateClient();
        using var request = status switch
        {
            401 => ApiRequests.Get(SiteSettingsRoute),
            403 => ApiRequests.Get(SiteSettingsRoute, TestTokens.For("Customer", TimeProvider.System)),
            404 => ApiRequests.Get("/api/v1/does-not-exist"),
            500 => ApiRequests.Get(SiteSettingsRoute, TestTokens.For(Roles.Manager, TimeProvider.System)),
            503 => ApiRequests.Get("/health"), // the parameterless factory's database does not exist
            _ => throw new ArgumentOutOfRangeException(nameof(status), status, "Unknown case."),
        };

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        ((int)response.StatusCode).ShouldBe(status);
        SecurityHeadersTests.AssertStrictHeaderSet(response, expectHsts: true);
        response.Headers.Contains("Server").ShouldBeFalse();
    }

    [Fact]
    public async Task UnservedMethodOnAPagePathIsChallenged()
    {
        // The SPA shell answers GET and HEAD on page paths only (WEB-01). Any other request that no endpoint serves
        // still meets the default-deny fallback policy (assumption A3).
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();
        using var request = ApiRequests.Create(HttpMethod.Post, "/nope");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("title").GetString().ShouldBe("Please sign in to continue.");
        ProblemJson.TraceId(problem);
    }

    [Theory]
    [InlineData("")]
    [InlineData("AAAAAAAAAAAAAAAAAAAAAA==")] // 16 bytes
    [InlineData("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==")] // 31 bytes
    [InlineData("not base64 at all!")]
    public async Task MissingOrShortSigningKeyFailsStartup(string signingKey)
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(TestJwt.SigningKeySetting, signingKey));

        var exception = Should.Throw<OptionsValidationException>(() => factory.CreateClient());

        exception.Failures.ShouldContain(Csps.Server.Composition.JwtOptions.SigningKeyInvalidMessage);
        exception.Message.ShouldNotContain(TestJwt.SigningKeyBase64);
    }

    [Theory]
    [InlineData(TestJwt.IssuerSetting, Csps.Server.Composition.JwtOptions.IssuerMissingMessage)]
    [InlineData(TestJwt.AudienceSetting, Csps.Server.Composition.JwtOptions.AudienceMissingMessage)]
    public async Task MissingIssuerOrAudienceFailsStartup(string setting, string message)
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(setting, string.Empty));

        var exception = Should.Throw<OptionsValidationException>(() => factory.CreateClient());

        exception.Failures.ShouldContain(message);
    }

    [Fact]
    public async Task ThirtyTwoByteSigningKeyStarts()
    {
        var key = Convert.ToBase64String(new byte[32]);
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseSetting(TestJwt.SigningKeySetting, key));
        using var client = factory.CreateClient();
        using var request = ApiRequests.Get(SiteSettingsRoute);

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    private static Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> ProductionWithThrowingReader(CspsApiFactory baseFactory) =>
        baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Production);
            builder.ConfigureTestServices(services =>
            {
                services.RemoveAll<ISiteSettingsReader>();
                services.AddScoped<ISiteSettingsReader, ThrowingSiteSettingsReader>();
            });
        });

    private static Microsoft.AspNetCore.Mvc.Testing.WebApplicationFactory<Program> WithFixedReader(CspsApiFactory baseFactory) =>
        baseFactory.WithWebHostBuilder(builder => builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<ISiteSettingsReader>();
            services.AddScoped<ISiteSettingsReader, FixedSiteSettingsReader>();
        }));

    /// <summary>A reader that answers from memory, so a signed-in request succeeds without a database.</summary>
    private sealed class FixedSiteSettingsReader : ISiteSettingsReader
    {
        public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
            ValueTask.FromResult(new SiteSettingsSnapshot(
                "Carmen's Stitch & Printing Services", "Asia/Manila", "PHP", "en-PH", string.Empty, string.Empty, string.Empty, string.Empty, "AAAAAAAAB9E="));
    }

    /// <summary>A reader whose failure message contains a secret, to prove a 500 never shows it.</summary>
    private sealed class ThrowingSiteSettingsReader : ISiteSettingsReader
    {
        public ValueTask<SiteSettingsSnapshot> GetAsync(CancellationToken cancellationToken) =>
            throw new InvalidOperationException(SecretText);
    }
}
