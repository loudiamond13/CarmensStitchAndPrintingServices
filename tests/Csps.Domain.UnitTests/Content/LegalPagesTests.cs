using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// LEGAL-05, D-10, D-22: the legal page facts in code equal the shared file the web node test also reads
/// (tests/fixtures/legal-pages.json). A change to one approved flag or version in only one place fails here.
/// </summary>
public sealed partial class LegalPagesTests
{
    private static readonly Lazy<FactsFile> Shared = new(Load);

    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    [Fact]
    public void AllEqualsTheSharedFileFieldByField()
    {
        LegalPages.All.Count.ShouldBe(Shared.Value.Pages.Count);
        foreach (var expected in Shared.Value.Pages)
        {
            var actual = LegalPages.ByPath(expected.Path).ShouldNotBeNull(expected.Path);
            actual.Key.ShouldBe(expected.Key, expected.Path);
            actual.Path.ShouldBe(expected.Path, expected.Path);
            actual.Version.ShouldBe(expected.Version, expected.Path);
            actual.LastUpdated.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture).ShouldBe(expected.LastUpdated, expected.Path);
            actual.Approved.ShouldBe(expected.Approved, expected.Path);
        }
    }

    [Fact]
    public void AllHoldsTheFourPagesInRouteOrder()
    {
        LegalPages.All.Select(page => page.Path).ShouldBe(["/privacy", "/cookies", "/terms", "/accessibility"]);
        LegalPages.All.Select(page => page.Key).ShouldBe(["privacy", "cookies", "terms", "accessibility"]);
    }

    [Fact]
    public void TheCookiePolicyVersionIsTheConsentPolicyVersion()
    {
        LegalPages.CookiePolicyVersion.ShouldBe(LegalPages.Cookies.Version);
        LegalPages.CookiePolicyVersion.ShouldBe(Shared.Value.Pages.Single(page => page.Key == "cookies").Version);
    }

    [Fact]
    public void EveryPageHasAVersionOfDigitsDotDigitsAndARealDate()
    {
        foreach (var page in LegalPages.All)
        {
            page.Version.ShouldNotBeNullOrWhiteSpace(page.Path);
            VersionShape().IsMatch(page.Version).ShouldBeTrue(page.Path);
            page.LastUpdated.ShouldNotBe(default, page.Path);
        }
    }

    [Theory]
    [InlineData("/privacy", true)]
    [InlineData("/cookies", true)]
    [InlineData("/terms", true)]
    [InlineData("/accessibility", true)]
    [InlineData("/contact", false)]
    [InlineData("/", false)]
    [InlineData("", false)]
    public void ByPathFindsOnlyTheLegalPaths(string path, bool found)
    {
        (LegalPages.ByPath(path) is not null).ShouldBe(found, path);
    }

    [Fact]
    public void EveryPageIsApprovedAtVersionOnePointZeroOnTheOwnersDate()
    {
        // The owner approved all four pages on 2026-11-18.
        LegalPages.All.ShouldAllBe(page => page.Approved);
        LegalPages.All.ShouldAllBe(page => page.Version == "1.0");
        LegalPages.All.ShouldAllBe(page => page.LastUpdated == new DateOnly(2026, 11, 18));
    }

    [GeneratedRegex(@"^[0-9]+\.[0-9]+$", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex VersionShape();

    private static FactsFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "legal-pages.json");
        return JsonSerializer.Deserialize<FactsFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The legal pages file is empty.");
    }

    private sealed record FactsFile(List<FactsRow> Pages);

    private sealed record FactsRow(string Key, string Path, string Version, string LastUpdated, bool Approved);
}
