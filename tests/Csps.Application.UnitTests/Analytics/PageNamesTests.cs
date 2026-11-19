using System.Reflection;
using System.Text.Json;
using Csps.Application.Analytics;
using Csps.Domain.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// D-69, D-75: the page names in code equal tests/fixtures/page-names.json, the file the web node test is also checked against, so the CSV and
/// the Visitor Stats page cannot name a page two ways.
/// </summary>
public sealed class PageNamesTests
{
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    [Fact(DisplayName = "matches the shared fixture")]
    public void MatchesTheSharedFixture()
    {
        var shared = Load().Pages.Select(static page => (page.Key, page.Name));

        PageNames.Ordered.ShouldBe(shared);
    }

    [Fact(DisplayName = "names every page key")]
    public void NamesEveryPageKey()
    {
        var keys = typeof(PageKeys)
            .GetFields(BindingFlags.Public | BindingFlags.Static)
            .Where(static field => field.IsLiteral && field.FieldType == typeof(string) && field.Name != nameof(PageKeys.MaxLength))
            .Select(static field => (string)field.GetRawConstantValue()!);

        Load().Pages.Select(static page => page.Key).ShouldBe(keys, ignoreOrder: true);
    }

    [Fact(DisplayName = "falls back to the key")]
    public void FallsBackToTheKey()
    {
        PageNames.NameFor("cookies").ShouldBe("cookies");
        PageNames.NameFor("home").ShouldBe("Home");
    }

    [Fact]
    public void AnUnknownKeySortsAfterEveryNamedPage()
    {
        PageNames.OrderOf("home").ShouldBe(0);
        PageNames.OrderOf("not-found").ShouldBe(PageNames.Ordered.Count - 1);
        PageNames.OrderOf("cookies").ShouldBe(PageNames.Ordered.Count);
    }

    [Fact]
    public void EveryNameIsSafeForACsvCell()
    {
        foreach (var (_, name) in PageNames.Ordered)
        {
            char.IsLetter(name[0]).ShouldBeTrue(name);
            name.IndexOfAny([',', '"', '\r', '\n']).ShouldBe(-1, name);
        }
    }

    private static NamesFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "page-names.json");
        return JsonSerializer.Deserialize<NamesFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The page names file is empty.");
    }

    private sealed record NamesFile(List<NamesRow> Pages);

    private sealed record NamesRow(string Key, string Name);
}
