using System.Net;
using System.Text.Json;
using Csps.Infrastructure.Persistence;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Content;

/// <summary>
/// PUB-03, CONT-05: the first public read after a committed content change returns the new value with a new ETag, and an old ETag no
/// longer earns a 304. The change goes through the host's own context, so its interceptors run.
/// </summary>
public sealed class PublicCacheInvalidationTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/v1/public/site";
    private static readonly DateTimeOffset Later = new(2026, 11, 12, 8, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task TheFirstReadAfterACommittedChangeShowsTheNewTaglineAndANewETag()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();

        await ChangeAsync(factory, PublicContentSeeding.Demo("Second line"));

        using var second = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await second.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        document.RootElement.GetProperty("tagline").GetString().ShouldBe("Second line");
        second.Headers.ETag.ShouldNotBeNull().ShouldNotBe(oldEtag);
    }

    [Fact]
    public async Task TheOldETagNoLongerGets304AfterAChange()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo("First line"));
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var first = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        var oldEtag = first.Headers.ETag.ShouldNotBeNull();
        await ChangeAsync(factory, PublicContentSeeding.Demo("Second line"));
        using var request = ApiRequests.Get(Route);
        request.Headers.TryAddWithoutValidation("If-None-Match", oldEtag.ToString());

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task ANewPhoneNumberShowsOnTheNextRead()
    {
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Demo());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        (await PhoneCountAsync(client)).ShouldBe(2);

        await ChangeAsync(
            factory,
            PublicContentSeeding.Demo() with
            {
                Phones = [.. PublicContentSeeding.Demo().Phones, new Csps.Domain.Content.BusinessPhone("0918 123 4567", "Smart", IsMain: false)],
            });

        (await PhoneCountAsync(client)).ShouldBe(3);
    }

    private static async Task ChangeAsync(CspsApiFactory factory, Csps.Domain.Content.BusinessInfo info)
    {
        var contexts = factory.Services.GetRequiredService<IDbContextFactory<CspsDbContext>>();
        await using var context = await contexts.CreateDbContextAsync(TestContext.Current.CancellationToken);
        await PublicContentSeeding.SaveAsync(context, info, Later);
    }

    private static async Task<int> PhoneCountAsync(HttpClient client)
    {
        using var response = await client.GetAsync(new Uri(Route, UriKind.Relative), TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return document.RootElement.GetProperty("phones").GetArrayLength();
    }
}
