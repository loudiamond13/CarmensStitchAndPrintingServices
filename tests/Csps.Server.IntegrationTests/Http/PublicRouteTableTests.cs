using System.Text.Json;
using Csps.Server.Endpoints;
using Microsoft.AspNetCore.Http;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// PUB-01, PUB-04: the server's known public paths are the list the client router is also tested against
/// (<c>tests/fixtures/public-paths.json</c>), matched case-insensitively with one optional trailing slash.
/// </summary>
public sealed class PublicRouteTableTests
{
    private const string SolutionFileName = "Csps.slnx";

    [Fact]
    public void PagePathsEqualTheSharedFixtureList()
    {
        var shared = ReadSharedPages();

        PublicRouteTable.PagePaths.ShouldBe(shared, ignoreOrder: true);
    }

    [Theory]
    [InlineData("/", PublicPage.Home, "/")]
    [InlineData("", PublicPage.Home, "/")]
    [InlineData("/products", PublicPage.Products, "/products")]
    [InlineData("/Products", PublicPage.Products, "/products")]
    [InlineData("/products/", PublicPage.Products, "/products")]
    [InlineData("/GALLERY/", PublicPage.Gallery, "/gallery")]
    [InlineData("/contact", PublicPage.Contact, "/contact")]
    [InlineData("/privacy", PublicPage.Privacy, "/privacy")]
    [InlineData("/Privacy/", PublicPage.Privacy, "/privacy")]
    public void KnownPagesMatchWithTheirLowerCaseCanonicalPath(string path, PublicPage page, string canonical)
    {
        var match = PublicRouteTable.Match(new PathString(path), devRoutesKnown: false);

        match.Kind.ShouldBe(PublicRouteKind.Page, path);
        match.Page.ShouldBe(page, path);
        match.CanonicalPath.ShouldBe(canonical, path);
    }

    [Theory]
    [InlineData("/admin")]
    [InlineData("/admin/")]
    [InlineData("/ADMIN/orders")]
    [InlineData("/admin/site-content/products")]
    public void AdminPathsMatchAdmin(string path)
    {
        var match = PublicRouteTable.Match(new PathString(path), devRoutesKnown: false);

        match.Kind.ShouldBe(PublicRouteKind.Admin, path);
        match.Page.ShouldBeNull(path);
        match.CanonicalPath.ShouldBeNull(path);
    }

    [Theory]
    [InlineData("/dev")]
    [InlineData("/dev/")]
    [InlineData("/Dev/components")]
    public void DevPathsAreKnownOnlyWhenAsked(string path)
    {
        PublicRouteTable.Match(new PathString(path), devRoutesKnown: true).Kind.ShouldBe(PublicRouteKind.Dev, path);
        PublicRouteTable.Match(new PathString(path), devRoutesKnown: false).Kind.ShouldBe(PublicRouteKind.NotFound, path);
    }

    [Theory]
    [InlineData("/nope")]
    [InlineData("/products/old")]
    [InlineData("/products//")]
    [InlineData("//products")]
    [InlineData("/administrator")]
    [InlineData("/developer")]
    [InlineData("/gallery/1")]
    public void EverythingElseIsNotFound(string path)
    {
        var match = PublicRouteTable.Match(new PathString(path), devRoutesKnown: true);

        match.Kind.ShouldBe(PublicRouteKind.NotFound, path);
        match.Page.ShouldBeNull(path);
        match.CanonicalPath.ShouldBeNull(path);
    }

    private static string[] ReadSharedPages()
    {
        var path = Path.Combine(RepositoryRoot(), "tests", "fixtures", "public-paths.json");
        using var document = JsonDocument.Parse(File.ReadAllText(path));
        return [.. document.RootElement.GetProperty("pages").EnumerateArray().Select(page => page.GetString()!)];
    }

    // Walks up from the test output folder to the folder that holds Csps.slnx (the repository root).
    private static string RepositoryRoot()
    {
        for (var directory = new DirectoryInfo(AppContext.BaseDirectory); directory is not null; directory = directory.Parent)
        {
            if (File.Exists(Path.Combine(directory.FullName, SolutionFileName)))
            {
                return directory.FullName;
            }
        }

        throw new InvalidOperationException($"{SolutionFileName} not found above {AppContext.BaseDirectory}.");
    }
}
