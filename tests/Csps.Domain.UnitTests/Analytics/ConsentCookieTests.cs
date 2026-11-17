using System.Globalization;
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

    /// <summary>Every invalid value in the shared file.</summary>
    public static TheoryData<string> InvalidValues
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var invalid in Cases.Value.Invalid)
            {
                data.Add(invalid);
            }

            return data;
        }
    }

    /// <summary>Every allowsStats case in the shared file.</summary>
    public static TheoryData<string, string, DateOnly, bool> AllowsStatsCases
    {
        get
        {
            var data = new TheoryData<string, string, DateOnly, bool>();
            foreach (var c in Cases.Value.AllowsStats)
            {
                data.Add(c.Value, c.CurrentVersion, c.Today, c.Expected);
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

    [Theory]
    [MemberData(nameof(InvalidValues))]
    public void TryParseRefusesTheSharedInvalidCaseWithoutThrowing(string value)
    {
        ConsentCookie.TryParse(value, out var cookie).ShouldBeFalse();

        cookie.ShouldBeNull();
    }

    [Fact]
    public void TryParseRefusesNull()
    {
        ConsentCookie.TryParse(null, out var cookie).ShouldBeFalse();

        cookie.ShouldBeNull();
    }

    [Fact]
    public void TheSharedFileHasTheBoundaryCasesOnBothSides()
    {
        Cases.Value.Invalid.Count.ShouldBeGreaterThanOrEqualTo(14);
        Cases.Value.Valid.ShouldContain(c => c.Value.Length == 100);
        Cases.Value.Invalid.ShouldContain(c => c.Length == 101);
        Cases.Value.Valid.ShouldContain(c => c.Stats == null);
        Cases.Value.Valid.ShouldContain(c => c.Pending);
    }

    [Theory]
    [MemberData(nameof(AllowsStatsCases))]
    public void AllowsStatsFollowsTheSharedCase(string value, string currentVersion, DateOnly today, bool expected)
    {
        ConsentCookie.TryParse(value, out var cookie).ShouldBeTrue();

        cookie.ShouldNotBeNull();
        cookie.AllowsStats(currentVersion, today).ShouldBe(expected);
    }

    [Fact]
    public void TheLifetimeIsTwelveMonths()
    {
        ConsentCookie.LifetimeMonths.ShouldBe(12);
    }

    [Fact]
    public void TheSharedFileHoldsTheReAskCasesTheWebSideReads()
    {
        Cases.Value.NeedsChoice.ShouldContain(c => c.Gpc);
        Cases.Value.NeedsChoice.ShouldContain(c => c.Value == null);
        Cases.Value.NeedsChoice.ShouldContain(c => c.Today == new DateOnly(2026, 11, 14) && !c.Expected);
        Cases.Value.AllowsStats.ShouldContain(c => c.Expected);
        Cases.Value.AllowsStats.ShouldContain(c => !c.Expected);
    }

    [Fact]
    public void TheSharedFileKeepsTheFutureDatedCasesOfD43()
    {
        Cases.Value.NeedsChoice.ShouldContain(c => !c.Gpc && IsFuture(c.Value, c.Today) && c.Expected);
        Cases.Value.NeedsChoice.ShouldContain(c => c.Gpc && IsFuture(c.Value, c.Today) && !c.Expected);
        Cases.Value.AllowsStats.ShouldContain(c => IsFuture(c.Value, c.Today) && !c.Expected);
    }

    // The day is the 8 digits before an optional "_p"; a day after today is a future decision (D-43).
    private static bool IsFuture(string? value, DateOnly today)
    {
        var day = value?.Split('_').FirstOrDefault(part => part.Length == 8 && part.All(char.IsAsciiDigit));
        return day is not null && string.CompareOrdinal(day, today.ToString("yyyyMMdd", CultureInfo.InvariantCulture)) > 0;
    }

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "consent-cookie-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The consent cookie case file is empty.");
    }

    private sealed record CaseFile(
        string Note,
        string CookieName,
        List<ValidCase> Valid,
        List<string> Invalid,
        List<NeedsChoiceCase> NeedsChoice,
        List<AllowsStatsCase> AllowsStats);

    private sealed record NeedsChoiceCase(string? Value, string CurrentVersion, DateOnly Today, bool Gpc, bool Expected);

    private sealed record AllowsStatsCase(string Value, string CurrentVersion, DateOnly Today, bool Expected);

    private sealed record ValidCase(
        string Value,
        string ConsentId,
        string PolicyVersion,
        bool? Stats,
        bool Map,
        DateOnly DecidedOn,
        bool Pending);
}
