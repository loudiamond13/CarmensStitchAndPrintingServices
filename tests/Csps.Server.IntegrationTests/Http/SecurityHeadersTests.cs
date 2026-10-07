using System.Net;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>SEC-01: every response carries the strict security header set exactly once.</summary>
public sealed class SecurityHeadersTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    /// <summary>The Content-Security-Policy header name.</summary>
    internal const string CspHeader = "Content-Security-Policy";

    /// <summary>PRD section 11.3, verbatim.</summary>
    internal const string StrictCsp =
        "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https://res.cloudinary.com; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests";

    internal const string PermissionsPolicy =
        "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()";

    internal const string Hsts = "max-age=31536000; includeSubDomains";

    [Fact]
    public async Task ApiErrorCarriesHeaderSet()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri("/api/v1/nope", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        AssertStrictHeaderSet(response, expectHsts: true);
    }

    [Fact]
    public async Task HstsOnlyOverHttps()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var httpClient = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost"), AllowAutoRedirect = false });
        using var httpsClient = factory.CreateClient();

        using var overHttp = await httpClient.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);
        using var overHttps = await httpsClient.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        overHttp.StatusCode.ShouldBe(HttpStatusCode.OK);
        AssertStrictHeaderSet(overHttp, expectHsts: false);
        overHttps.StatusCode.ShouldBe(HttpStatusCode.OK);
        AssertStrictHeaderSet(overHttps, expectHsts: true);
    }

    [Theory]
    [InlineData("/health")]
    [InlineData("/api/v1/nope")]
    public async Task EachHeaderAppearsOnce(string path)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);

        AssertStrictHeaderSet(response, expectHsts: true);
        response.Headers.Contains("Server").ShouldBeFalse();
        response.Headers.Contains("X-Powered-By").ShouldBeFalse();
    }

    [Fact]
    public async Task HeadHealthCarriesHeaders()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Head, new Uri("/health", UriKind.Relative));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        AssertStrictHeaderSet(response, expectHsts: true);
    }

    [Fact]
    public async Task ProductionRedirectsHttpToHttps()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Production));
        using var client = factory.CreateClient(new WebApplicationFactoryClientOptions { BaseAddress = new Uri("http://localhost"), AllowAutoRedirect = false });

        using var response = await client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

        ((int)response.StatusCode).ShouldBeOneOf(307, 308);
        response.Headers.Location.ShouldNotBeNull().ToString().ShouldStartWith("https://localhost", Case.Sensitive);
        response.Headers.Contains("Strict-Transport-Security").ShouldBeFalse();
    }

    /// <summary>Asserts every SEC-01 header is present exactly once with its exact value.</summary>
    /// <param name="response">The response to check.</param>
    /// <param name="expectHsts">Whether Strict-Transport-Security must be present (HTTPS) or absent (HTTP).</param>
    internal static void AssertStrictHeaderSet(HttpResponseMessage response, bool expectHsts)
    {
        Single(response, CspHeader).ShouldBe(StrictCsp);
        Single(response, "X-Content-Type-Options").ShouldBe("nosniff");
        Single(response, "Referrer-Policy").ShouldBe("strict-origin-when-cross-origin");
        Single(response, "Permissions-Policy").ShouldBe(PermissionsPolicy);
        Single(response, "Cross-Origin-Opener-Policy").ShouldBe("same-origin");
        if (expectHsts)
        {
            Single(response, "Strict-Transport-Security").ShouldBe(Hsts);
        }
        else
        {
            response.Headers.Contains("Strict-Transport-Security").ShouldBeFalse();
        }
    }

    /// <summary>Returns the only value of a response header, failing when it is missing or repeated.</summary>
    /// <param name="response">The response to read.</param>
    /// <param name="name">The header name.</param>
    /// <returns>The single header value.</returns>
    internal static string Single(HttpResponseMessage response, string name)
    {
        response.Headers.TryGetValues(name, out var values).ShouldBeTrue($"missing header {name}");
        return values.ShouldNotBeNull().ShouldHaveSingleItem();
    }
}
