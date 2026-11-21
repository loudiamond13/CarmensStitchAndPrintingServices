using Csps.Domain.Analytics;
using Csps.Server.Endpoints;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>ANL-05, T-12-29: a path maps through the route table to one of the eight page keys; admin and developer paths map to nothing.</summary>
public sealed class PublicPageResolverTests
{
    [Theory]
    [InlineData("/", "home")]
    [InlineData("/products", "products")]
    [InlineData("/gallery", "gallery")]
    [InlineData("/contact", "contact")]
    [InlineData("/privacy", "privacy")]
    [InlineData("/terms", "terms")]
    [InlineData("/accessibility", "accessibility")]
    [InlineData("/Gallery/", "gallery")]
    public void AKnownPageGivesItsKeyWhateverTheCaseOrATrailingSlash(string path, string key)
    {
        new PublicPageResolver(new FakeEnvironment("Production")).PageKeyFor(path).ShouldBe(key);
    }

    [Theory]
    [InlineData("/nope")]
    [InlineData("/cookies")]
    [InlineData("/gallery/extra")]
    [InlineData("/api/v1/orders")]
    [InlineData("/dev")]
    public void AnyOtherPublicPathCountsAsNotFoundWhenNoDevPathsExist(string path)
    {
        new PublicPageResolver(new FakeEnvironment("Production")).PageKeyFor(path).ShouldBe(PageKeys.NotFound);
    }

    [Theory]
    [InlineData("/admin")]
    [InlineData("/admin/orders")]
    [InlineData("/ADMIN/orders/")]
    public void AnAdminPathStoresNothing(string path)
    {
        new PublicPageResolver(new FakeEnvironment("Production")).PageKeyFor(path).ShouldBeNull();
    }

    [Theory]
    [InlineData("Development")]
    [InlineData("Testing")]
    public void ADevPathStoresNothingWhereDevPathsExist(string environment)
    {
        new PublicPageResolver(new FakeEnvironment(environment)).PageKeyFor("/dev/preview").ShouldBeNull();
    }

    [Fact]
    public void EveryPublicPageHasAKnownKey()
    {
        var resolver = new PublicPageResolver(new FakeEnvironment("Production"));

        foreach (var path in PublicRouteTable.PagePaths)
        {
            resolver.PageKeyFor(path).ShouldNotBeNull(path);
        }

        PublicRouteTable.PagePaths.Select(resolver.PageKeyFor).Distinct().Count().ShouldBe(Enum.GetValues<PublicPage>().Length);
    }

    private sealed class FakeEnvironment(string name) : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = name;

        public string ApplicationName { get; set; } = "Csps.Server";

        public string ContentRootPath { get; set; } = string.Empty;

        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}
