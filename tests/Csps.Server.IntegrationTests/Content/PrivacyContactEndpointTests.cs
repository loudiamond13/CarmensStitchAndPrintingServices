using System.Net;
using System.Text.Json;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// D-13, D-29: <c>GET /api/v1/public/privacy-contact</c> answers anonymously with the shop's Contact email for the legal pages, kept
/// out of every other public answer.
/// </summary>
public sealed class PrivacyContactEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/public/privacy-contact";
    private const string DemoEmail = "shop-private@example.test";
    private static readonly DateTimeOffset Later = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnAnonymousVisitorGetsTheStoredContactEmail()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        response.Content.Headers.ContentType.ShouldNotBeNull().MediaType.ShouldBe("application/json");
        response.Headers.CacheControl.ShouldNotBeNull().NoStore.ShouldBeTrue();
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.EnumerateObject().Select(property => property.Name).ShouldBe(["email"]);
        document.RootElement.GetProperty("email").GetString().ShouldBe(DemoEmail);
    }

    [Fact]
    public async Task AnEmptyStoredEmailAnswers200WithANullEmail()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("email").ValueKind.ShouldBe(JsonValueKind.Null);
    }

    [Fact]
    public async Task ASettingsSaveShowsTheNewEmailOnTheNextRead()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        (await ReadEmailAsync(client)).ShouldBe(DemoEmail);

        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        await using (var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken))
        {
            await PublicContentSeeding.SaveAsync(context, PublicContentSeeding.Demo() with { ContactEmail = "other-private@example.test" }, Later);
        }

        (await ReadEmailAsync(client)).ShouldBe("other-private@example.test");
    }

    private static async Task<string?> ReadEmailAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("email").GetString();
    }
}
