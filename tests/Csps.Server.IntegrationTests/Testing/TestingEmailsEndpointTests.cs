using System.Net;
using System.Text.Json;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Domain.Identity;
using Csps.Server.Composition;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// QUAL-05, D-27, D-37: in the Testing environment of a Debug build the sink's mail is readable at
/// <c>GET /api/testing/emails</c>; in every other environment the route does not exist, and a Debug build refuses to
/// run as Production.
/// </summary>
public sealed class TestingEmailsEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/emails";
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(5);

    [Fact]
    public async Task DeliveredEmailIsReadableAfterACursor()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var to = NewAddress();

        await QueueCodeAsync(factory, to);

        using var first = await PollAsync(client, $"{Route}?after=0&to={to}");
        first.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        var messages = await ReadArrayAsync(first);
        var message = messages.ShouldHaveSingleItem();
        message.GetProperty("to").GetString().ShouldBe(to);
        message.GetProperty("subject").GetString().ShouldBe("048213 is your CSPS sign-in code");
        message.GetProperty("text").GetString().ShouldNotBeNull().ShouldContain("048213");
        message.GetProperty("html").GetString().ShouldNotBeNull().ShouldContain("048213");
        message.GetProperty("sentAt").GetDateTimeOffset().ShouldBeGreaterThan(TimeProvider.System.GetUtcNow().AddMinutes(-5));
        var id = message.GetProperty("id").GetInt64();

        using var next = await client.GetAsync(new Uri($"{Route}?after={id}&to={to}", UriKind.Relative), TestContext.Current.CancellationToken);
        next.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await ReadArrayAsync(next)).ShouldBeEmpty();
    }

    [Fact]
    public async Task AnotherAddressSeesNothing()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var to = NewAddress();
        await QueueCodeAsync(factory, to);
        using var delivered = await PollAsync(client, $"{Route}?after=0&to={to}");
        delivered.StatusCode.ShouldBe(HttpStatusCode.OK);

        using var other = await client.GetAsync(new Uri($"{Route}?after=0&to={NewAddress()}", UriKind.Relative), TestContext.Current.CancellationToken);

        (await ReadArrayAsync(other)).ShouldBeEmpty();
    }

    [Fact]
    public async Task DevelopmentDoesNotMapTheRoute()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri($"{Route}?after=0", UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(404);
    }

    [Fact]
    public async Task ADebugBuildRefusesToRunAsProduction()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing features to guard.");
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(Environments.Production);
            builder.UseSetting("Csps:Testing:AllowProductionEnvironment", "false");
        });

        var exception = Should.Throw<InvalidOperationException>(() => factory.CreateClient());

        exception.Message.ShouldContain("Testing features");
    }

    private static string NewAddress() => $"paolo.{Guid.NewGuid():N}@example.com";

    private static async Task QueueCodeAsync(CspsApiFactory factory, string to)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var now = TimeProvider.System.GetUtcNow();
            var email = new SignInCodeEmail(to, "048213", now.AddMinutes(15), now, new DeviceDescription("Chrome on Android", true));
            await scope.ServiceProvider.GetRequiredService<IEmailOutbox>().EnqueueAsync(email, TestContext.Current.CancellationToken);
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }
    }

    // Polls until the sink holds mail for the query, because the dispatcher delivers a moment after the commit.
    private static async Task<HttpResponseMessage> PollAsync(HttpClient client, string path)
    {
        using var limit = CancellationTokenSource.CreateLinkedTokenSource(TestContext.Current.CancellationToken);
        limit.CancelAfter(Patience);
        while (!limit.IsCancellationRequested)
        {
            var response = await client.GetAsync(new Uri(path, UriKind.Relative), TestContext.Current.CancellationToken);
            if (response.StatusCode == HttpStatusCode.OK && (await ReadArrayAsync(response)).Count > 0)
            {
                return response;
            }

            response.Dispose();
            await Task.Delay(TimeSpan.FromMilliseconds(100), CancellationToken.None);
        }

        throw new TimeoutException($"The sink returned no mail for {path} within {Patience}.");
    }

    private static async Task<List<JsonElement>> ReadArrayAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);
        return [.. document.RootElement.EnumerateArray().Select(static item => item.Clone())];
    }
}
