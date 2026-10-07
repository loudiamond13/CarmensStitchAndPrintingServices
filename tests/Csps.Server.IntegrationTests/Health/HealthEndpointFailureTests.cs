using System.Net;
using System.Net.Http.Headers;
using Csps.Testing;
using Microsoft.Data.SqlClient;

namespace Csps.Server.IntegrationTests.Health;

/// <summary>
/// FND-06, D-23, T-01-10: every <c>/health</c> failure mode keeps the body to status plus name/status pairs, maps
/// Unhealthy to 503 and Degraded to 200, and is never cacheable. Runs the real pipeline; nothing is mocked.
/// </summary>
public sealed class HealthEndpointFailureTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // Text that would reveal internals: exception types, SQL errors, connection-string parts, timings, versions.
    private static readonly string[] ForbiddenText =
        ["Exception", "SqlException", "Server=", "Data Source", "Login failed", "CSPS_Test_", "duration", "description", "version"];

    [Fact]
    public async Task DatabaseUnreachableReturns503Minimal()
    {
        // The parameterless factory points at a CSPS_Test_ database name that is never created.
        await using var factory = new CspsApiFactory();
        using var client = factory.CreateClient();

        using var response = await GetHealthAsync(client);

        response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
        ShouldNotBeCacheable(response);
        var body = await ReadBodyAsync(response);
        body.ShouldBe(
            """{"status":"Unhealthy","checks":[{"name":"self","status":"Healthy"},{"name":"database","status":"Unhealthy"},{"name":"time-zone","status":"Unhealthy"}]}""");
        ShouldExposeNoInternals(body);
    }

    [Fact]
    public async Task MissingSettingsRowMakesTimeZoneUnhealthy()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await ExecuteAsync(adHoc, "DELETE FROM dbo.SiteSettings;");
            await using var factory = CspsApiFactory.ForDatabase(adHoc.ConnectionString);
            using var client = factory.CreateClient();

            using var response = await GetHealthAsync(client);

            response.StatusCode.ShouldBe(HttpStatusCode.ServiceUnavailable);
            ShouldNotBeCacheable(response);
            var body = await ReadBodyAsync(response);
            var (status, checks) = HealthBody.Parse(body);
            status.ShouldBe("Unhealthy");
            checks["database"].ShouldBe("Healthy");
            checks["time-zone"].ShouldBe("Unhealthy");
            ShouldExposeNoInternals(body);
        }
    }

    [Fact]
    public async Task UnknownStoredZoneIsDegradedNot503()
    {
        var adHoc = await CspsDatabase.CreateAsync();
        await using (adHoc)
        {
            await ExecuteAsync(adHoc, "UPDATE dbo.SiteSettings SET TimeZoneId = N'Mars/Olympus' WHERE Id = 1;");
            await using var factory = CspsApiFactory.ForDatabase(adHoc.ConnectionString);
            using var client = factory.CreateClient();

            using var response = await GetHealthAsync(client);

            response.StatusCode.ShouldBe(HttpStatusCode.OK);
            ShouldNotBeCacheable(response);
            var body = await ReadBodyAsync(response);
            body.ShouldBe(
                """{"status":"Degraded","checks":[{"name":"self","status":"Healthy"},{"name":"database","status":"Healthy"},{"name":"time-zone","status":"Degraded"}]}""");
            ShouldExposeNoInternals(body);
        }
    }

    [Fact]
    public async Task HtmlAcceptStillGetsJson()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri("/health", UriKind.Relative));
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("text/html"));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.ShouldBe("application/json");
        ShouldNotBeCacheable(response);
        var body = await ReadBodyAsync(response);
        HealthBody.Parse(body).Status.ShouldBe("Healthy");
        ShouldExposeNoInternals(body);
    }

    [Fact]
    public async Task HeadRequestCarriesNoStore()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Head, new Uri("/health", UriKind.Relative));

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        ShouldNotBeCacheable(response);
        (await ReadBodyAsync(response)).ShouldBeEmpty();
    }

    private static Task<HttpResponseMessage> GetHealthAsync(HttpClient client) =>
        client.GetAsync(new Uri("/health", UriKind.Relative), TestContext.Current.CancellationToken);

    private static Task<string> ReadBodyAsync(HttpResponseMessage response) =>
        response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

    private static void ShouldNotBeCacheable(HttpResponseMessage response) =>
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();

    private static void ShouldExposeNoInternals(string body)
    {
        foreach (var text in ForbiddenText)
        {
            body.ShouldNotContain(text, Case.Insensitive);
        }

        HealthBody.PropertyNames(body).ShouldBe(HealthBody.AllowedPropertyNames, ignoreOrder: true);
    }

    private static async Task ExecuteAsync(CspsDatabase target, string sql)
    {
        var connection = new SqlConnection(target.ConnectionString);
        await using (connection)
        {
            await connection.OpenAsync(TestContext.Current.CancellationToken);
            var command = connection.CreateCommand();
            await using (command)
            {
                command.CommandText = sql;
                await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
            }
        }
    }
}
