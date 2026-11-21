using Csps.Server.Security;
using Csps.Testing;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.RateLimiting;

/// <summary>
/// D-138, IN-G1-03: the site-wide page view ceiling keys on an endpoint name, so exactly one endpoint, the page view POST, must carry it.
/// </summary>
public sealed class PageViewCeilingRouteTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    [Fact]
    public async Task ExactlyOneEndpointCarriesTheCeilingNameAndItIsThePageViewPost()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var named = factory.Services.GetRequiredService<EndpointDataSource>().Endpoints.OfType<RouteEndpoint>()
            .Where(endpoint => string.Equals(
                endpoint.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName,
                RateLimitingRegistration.PageViewEndpointName,
                StringComparison.Ordinal))
            .ToList();

        var pageView = named.ShouldHaveSingleItem("The site-wide page view ceiling keys on this endpoint name, so exactly one endpoint must carry it.");
        pageView.RoutePattern.RawText.ShouldBe("api/v1/analytics/page-views");
        pageView.Metadata.GetMetadata<IHttpMethodMetadata>().ShouldNotBeNull().HttpMethods.ShouldHaveSingleItem().ShouldBe("POST");
    }
}
