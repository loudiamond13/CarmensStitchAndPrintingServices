using System.Text.Json;
using Csps.Application.Analytics;
using Csps.Domain.Analytics;

namespace Csps.Application.UnitTests.Analytics;

/// <summary>
/// ANL-05, OR-3: the page view validator accepts and refuses exactly the paths in tests/fixtures/page-view-path-cases.json, the file the web
/// check is tested against too, so the browser drops every path the server would refuse.
/// </summary>
public sealed class PageViewPathCasesTests
{
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    private static readonly CasesFile Cases = Load();

    private readonly PageViewRequestValidator _validator = new();

    public static TheoryData<string> Accepted => [.. Cases.Accept, LongPath(Cases.MaxLength)];

    public static TheoryData<string> Refused => [.. Cases.Refuse, LongPath(Cases.MaxLength + 1)];

    [Fact]
    public void TheSharedLengthIsTheServerLimit()
    {
        Cases.MaxLength.ShouldBe(AnalyticsPath.MaxLength);
    }

    [Theory]
    [MemberData(nameof(Accepted))]
    public void AcceptsEveryAcceptedPath(string path)
    {
        _validator.Validate(new PageViewRequest(path)).IsValid.ShouldBeTrue(path.Length > 40 ? $"length {path.Length}" : path);
    }

    [Theory]
    [MemberData(nameof(Refused))]
    public void RefusesEveryRefusedPath(string path)
    {
        _validator.Validate(new PageViewRequest(path)).IsValid.ShouldBeFalse(path.Length > 40 ? $"length {path.Length}" : path);
    }

    // A slash and then letters, `length` characters in all: the web test builds the same two boundary paths.
    private static string LongPath(int length) => "/" + new string('a', length - 1);

    private static CasesFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "page-view-path-cases.json");
        return JsonSerializer.Deserialize<CasesFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The page view path cases file is empty.");
    }

    private sealed record CasesFile(int MaxLength, List<string> Accept, List<string> Refuse);
}
