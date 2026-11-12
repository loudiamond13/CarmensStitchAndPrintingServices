using System.Net;
using System.Text.Json;
using Csps.Server.Composition;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// QUAL-05, D-37: <c>POST /api/testing/site-content</c> puts the demo business info and the two demo phone numbers in place for E2E
/// specs, in the Testing environment of a Debug build only. Running it again leaves the same rows.
/// </summary>
public sealed class TestingSiteContentTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/site-content";

    [Fact]
    public async Task APostAnswers204AndTheDemoFactsAreOnThePublicRead()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await PublicContentSeeding.SaveAsync(database, PublicContentSeeding.Bare());
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var seed = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        using var read = await client.GetAsync(new Uri("/api/v1/public/site", UriKind.Relative), TestContext.Current.CancellationToken);

        seed.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        using var document = JsonDocument.Parse(await read.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var site = document.RootElement;
        site.GetProperty("address").GetProperty("street").GetString().ShouldBe("12 Sample St., Poblacion");
        site.GetProperty("address").GetProperty("townOrCity").GetString().ShouldBe("Sample City");
        site.GetProperty("messengerUrl").GetString().ShouldBe("https://m.me/cspsdemo");
        var phones = site.GetProperty("phones");
        phones.GetArrayLength().ShouldBe(2);
        phones[0].GetProperty("display").GetString().ShouldBe("0917 123 4567");
        phones[0].GetProperty("isMain").GetBoolean().ShouldBeTrue();
        phones[1].GetProperty("display").GetString().ShouldBe("02 8123 4567");
    }

    [Fact]
    public async Task RunningItTwiceLeavesTheSameRows()
    {
        Assert.SkipUnless(BuildFlavor.HasTestingFeatures, "Release builds have no Testing routes.");
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var once = await PhoneNumbersAsync();
        using var second = await client.PostAsync(new Uri(Route, UriKind.Relative), content: null, TestContext.Current.CancellationToken);
        var twice = await PhoneNumbersAsync();

        first.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        second.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        once.ShouldBe(["+639171234567", "+63281234567"]);
        twice.ShouldBe(once);
    }

    private async Task<List<string>> PhoneNumbersAsync()
    {
        await using var context = database.CreateContext();
        return await context.SitePhoneNumbers.AsNoTracking().OrderBy(phone => phone.Position).Select(phone => phone.Number).ToListAsync(TestContext.Current.CancellationToken);
    }
}
