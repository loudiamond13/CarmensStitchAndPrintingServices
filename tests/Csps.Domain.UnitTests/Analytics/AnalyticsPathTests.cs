using System.Reflection;
using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

public sealed class AnalyticsPathTests
{
    [Theory]
    [InlineData("/gallery?q=jersey#top", "/gallery")]
    [InlineData("/contact#map", "/contact")]
    [InlineData("/products", "/products")]
    [InlineData("/?x=1", "/")]
    [InlineData("/", "/")]
    [InlineData("/gallery#a?b", "/gallery")]
    [InlineData("/gallery?a#b", "/gallery")]
    public void QueryAndFragmentAreCutOff(string path, string expected)
    {
        AnalyticsPath.Cut(path).ShouldBe(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("gallery")]
    [InlineData("https://evil.example/")]
    [InlineData("?q=1")]
    [InlineData("#top")]
    public void ThingsThatAreNotARootRelativePathGiveNull(string? path)
    {
        AnalyticsPath.Cut(path).ShouldBeNull();
    }

    [Fact]
    public void MaxLengthIs2048()
    {
        AnalyticsPath.MaxLength.ShouldBe(2048);
    }

    [Fact]
    public void PathOfExactlyMaxLengthIsKept()
    {
        var path = "/" + new string('a', AnalyticsPath.MaxLength - 1);

        AnalyticsPath.Cut(path).ShouldBe(path);
    }

    [Fact]
    public void PathOneOverMaxLengthGivesNull()
    {
        var path = "/" + new string('a', AnalyticsPath.MaxLength);

        AnalyticsPath.Cut(path).ShouldBeNull();
    }

    [Fact]
    public void LongQueryNeverRejectsAShortPath()
    {
        var path = "/a?" + new string('b', 5000);

        AnalyticsPath.Cut(path).ShouldBe("/a");
    }

    [Fact]
    public void LongFragmentNeverRejectsAShortPath()
    {
        var path = "/a#" + new string('b', 5000);

        AnalyticsPath.Cut(path).ShouldBe("/a");
    }

    [Fact]
    public void PageKeysAreTheNineLowercaseNames()
    {
        var keys = typeof(PageKeys)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .ToDictionary(f => f.Name, f => (string)f.GetRawConstantValue()!);

        keys.ShouldBe(
            new Dictionary<string, string>
            {
                ["Home"] = "home",
                ["Products"] = "products",
                ["Gallery"] = "gallery",
                ["Contact"] = "contact",
                ["Privacy"] = "privacy",
                ["Cookies"] = "cookies",
                ["Terms"] = "terms",
                ["Accessibility"] = "accessibility",
                ["NotFound"] = "not-found",
            },
            ignoreOrder: true);
    }

    [Fact]
    public void PageKeysFitTheColumn()
    {
        PageKeys.MaxLength.ShouldBe(32);

        var keys = typeof(PageKeys)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(f => f.IsLiteral && f.FieldType == typeof(string))
            .Select(f => (string)f.GetRawConstantValue()!);

        keys.ShouldAllBe(key => key.Length > 0 && key.Length <= PageKeys.MaxLength);
    }
}
