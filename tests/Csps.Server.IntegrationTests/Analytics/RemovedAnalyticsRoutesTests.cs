using System.Net;
using Csps.Testing;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>D-59: the consent, clear and speed sample routes are gone, so a call to the old addresses is a plain 404.</summary>
public sealed class RemovedAnalyticsRoutesTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Theory]
    [InlineData("/api/v1/analytics/consent")]
    [InlineData("/api/v1/analytics/clear")]
    [InlineData("/api/v1/analytics/vitals")]
    public async Task TheOldRoutesAnswerNotFound(string route)
    {
        await database.ResetAsync();
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AnalyticsHttp.NewClient(factory);
        using var request = AnalyticsHttp.NewPost(route, "{}");

        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }
}
