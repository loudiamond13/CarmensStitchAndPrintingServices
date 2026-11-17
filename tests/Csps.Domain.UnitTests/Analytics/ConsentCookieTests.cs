using System.Text.Json;
using Csps.Domain.Analytics;

namespace Csps.Domain.UnitTests.Analytics;

/// <summary>
/// ANL-07: the consent cookie codec. The cases come from the shared file that the web Vitest suite also reads
/// (tests/fixtures/consent-cookie-cases.json). The file is only read here.
/// </summary>
public sealed class ConsentCookieTests
{
    private static readonly Lazy<CaseFile> Cases = new(Load);

    // Fails closed: a renamed, missing or unknown member is an error, never a silent default.
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    /// <summary>The value of every valid case in the shared file.</summary>
    public static TheoryData<string> ValidValues
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var valid in Cases.Value.Valid)
            {
                data.Add(valid.Value);
            }

            return data;
        }
    }

    [Fact]
    public void TheCookieNameIsThePinnedOneOfTheSharedFile()
    {
        ConsentCookie.CookieName.ShouldBe(Cases.Value.CookieName);
        ConsentCookie.CookieName.ShouldBe("__Host-csps_consent");
    }

    [Theory]
    [MemberData(nameof(ValidValues))]
    public void TryParseReadsTheSharedValidCase(string value)
    {
        var expected = Cases.Value.Valid.Single(c => c.Value == value);

        ConsentCookie.TryParse(value, out var cookie).ShouldBeTrue();

        cookie.ShouldNotBeNull();
        cookie.ConsentId.ToString("N").ShouldBe(expected.ConsentId);
        cookie.PolicyVersion.ShouldBe(expected.PolicyVersion);
        cookie.Stats.ShouldBe(expected.Stats);
        cookie.Map.ShouldBe(expected.Map);
        cookie.DecidedOn.ShouldBe(expected.DecidedOn);
        cookie.Pending.ShouldBe(expected.Pending);
    }

    [Theory]
    [MemberData(nameof(ValidValues))]
    public void FormatGivesTheSharedValueBack(string value)
    {
        ConsentCookie.TryParse(value, out var cookie).ShouldBeTrue();

        cookie.ShouldNotBeNull();
        cookie.Format().ShouldBe(value);
    }

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "consent-cookie-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The consent cookie case file is empty.");
    }

    private sealed record CaseFile(string Note, string CookieName, List<ValidCase> Valid);

    private sealed record ValidCase(
        string Value,
        string ConsentId,
        string PolicyVersion,
        bool? Stats,
        bool Map,
        DateOnly DecidedOn,
        bool Pending);
}
