using System.Text.Json;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// CONT-01, D-24, CWE-601: the link rules accept only https on an allow-listed host and refuse scripts, bracket placeholders and
/// values with spaces. The cases come from the shared file that the web zod test also reads (tests/fixtures/site-link-cases.json).
/// The file is only read here.
/// </summary>
public sealed class SiteLinksTests
{
    private static readonly Lazy<CaseFile> Cases = new(Load);

    // Fails closed: a renamed, missing or unknown member is an error, never a silent default.
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    private static readonly IReadOnlyDictionary<string, Func<string?, bool>> Rules = new Dictionary<string, Func<string?, bool>>(StringComparer.Ordinal)
    {
        ["messenger"] = SiteLinks.IsMessengerLink,
        ["facebook"] = SiteLinks.IsFacebookLink,
        ["instagram"] = SiteLinks.IsInstagramLink,
        ["tiktok"] = SiteLinks.IsTikTokLink,
        ["directions"] = SiteLinks.IsDirectionsLink,
        ["embed"] = SiteLinks.IsMapEmbedLink,
    };

    /// <summary>The rule names in the shared file.</summary>
    public static TheoryData<string> RuleNames => [.. Rules.Keys];

    /// <summary>Every accept case of every rule.</summary>
    public static TheoryData<string, string> AcceptCases => Flatten(static set => set.Accept);

    /// <summary>Every refuse case of every rule.</summary>
    public static TheoryData<string, string> RefuseCases => Flatten(static set => set.Refuse);

    [Theory]
    [MemberData(nameof(AcceptCases))]
    public void AnAllowListedLinkIsAccepted(string rule, string link) =>
        Rules[rule](link).ShouldBeTrue($"{rule}: {link}");

    [Theory]
    [MemberData(nameof(RefuseCases))]
    public void ALinkOutsideTheRuleIsRefused(string rule, string link) =>
        Rules[rule](link).ShouldBeFalse($"{rule}: {link}");

    [Theory]
    [MemberData(nameof(RuleNames))]
    public void EveryRuleRefusesAScriptABracketPlaceholderAndAValueWithSpaces(string rule)
    {
        foreach (var link in Cases.Value.RefuseEverywhere)
        {
            Rules[rule](link).ShouldBeFalse($"{rule}: {link}");
        }
    }

    [Theory]
    [MemberData(nameof(RuleNames))]
    public void ANullLinkIsRefused(string rule) => Rules[rule](null).ShouldBeFalse(rule);

    [Fact]
    public void TheSharedFileHoldsAnAcceptedAndARefusedCaseForEveryRule()
    {
        foreach (var rule in Rules.Keys)
        {
            var set = Cases.Value.Set(rule);
            set.Accept.ShouldNotBeEmpty(rule);
            set.Refuse.ShouldNotBeEmpty(rule);
        }

        Cases.Value.RefuseEverywhere.ShouldContain("javascript:alert(1)");
        Cases.Value.Messenger.Accept.ShouldContain(link => link.StartsWith("https://m.me/", StringComparison.Ordinal));
    }

    [Theory]
    [InlineData("[Shop address]", true)]
    [InlineData("12 Rizal St. [barangay]", true)]
    [InlineData("[]", true)]
    [InlineData("Teams, leagues and riding groups.", false)]
    [InlineData("] before [", false)]
    [InlineData("only [ open", false)]
    [InlineData("only ] close", false)]
    [InlineData("", false)]
    public void ABracketPlaceholderIsAnOpenBracketFollowedByACloseBracket(string text, bool expected) =>
        SiteLinks.HasBracketPlaceholder(text).ShouldBe(expected, text);

    [Fact]
    public void ANullTextHoldsNoPlaceholder() => SiteLinks.HasBracketPlaceholder(null).ShouldBeFalse();

    [Fact]
    public void TheSixMessagesAreTheApprovedWording()
    {
        SiteLinks.MessengerInvalidMessage.ShouldBe("Paste your Messenger link, like https://m.me/yourpage.");
        SiteLinks.FacebookInvalidMessage.ShouldBe("Paste your Facebook page link, like https://www.facebook.com/yourpage.");
        SiteLinks.InstagramInvalidMessage.ShouldBe("Paste your Instagram link, like https://www.instagram.com/yourpage.");
        SiteLinks.TikTokInvalidMessage.ShouldBe("Paste your TikTok link, like https://www.tiktok.com/@yourpage.");
        SiteLinks.DirectionsInvalidMessage.ShouldBe("Paste a Google Maps link, like https://maps.app.goo.gl/abc123.");
        SiteLinks.MapEmbedInvalidMessage.ShouldBe("Paste the embed code or link from Google Maps. It starts with https://www.google.com/maps/embed.");
    }

    [Theory]
    [InlineData("8600", true)]
    [InlineData("0000", true)]
    [InlineData("860", false)]
    [InlineData("86000", false)]
    [InlineData("86a0", false)]
    [InlineData("8 600", false)]
    [InlineData(" 8600", false)]
    [InlineData("٨٦٠٠", false)]
    [InlineData("", false)]
    public void APostalCodeIsExactlyFourAsciiDigits(string code, bool expected) =>
        SiteLinks.IsPostalCode(code).ShouldBe(expected, code);

    [Fact]
    public void ANullPostalCodeIsRefused() => SiteLinks.IsPostalCode(null).ShouldBeFalse();

    [Theory]
    [InlineData("shop@example.test", true)]
    [InlineData("a@b", true)]
    [InlineData("name", false)]
    [InlineData("a@b@c.test", false)]
    [InlineData("@example.test", false)]
    [InlineData("name@", false)]
    [InlineData("[hello@yourdomain.ph]", false)]
    [InlineData("[shop]@example.test", false)]
    [InlineData("", false)]
    public void AContactEmailHasOneAtSignWithTextOnBothSidesAndNoPlaceholder(string email, bool expected) =>
        SiteLinks.IsContactEmail(email).ShouldBe(expected, email);

    [Fact]
    public void AContactEmailFitsAt254CharactersAndIsRefusedAt255()
    {
        var local = new string('a', SiteSettings.ContactEmailMaxLength - "@example.test".Length);

        SiteLinks.IsContactEmail($"{local}@example.test").ShouldBeTrue();
        SiteLinks.IsContactEmail($"{local}a@example.test").ShouldBeFalse();
    }

    [Fact]
    public void ANullContactEmailIsRefused() => SiteLinks.IsContactEmail(null).ShouldBeFalse();

    [Fact]
    public void ThePostalCodeAndEmailMessagesAreTheApprovedWording()
    {
        SiteLinks.PostalCodeInvalidMessage.ShouldBe("Use the 4-digit postal code, like 8600.");
        SiteLinks.ContactEmailInvalidMessage.ShouldBe("Enter a valid email, like name@gmail.com");
    }

    private static TheoryData<string, string> Flatten(Func<RuleCases, List<string>> pick)
    {
        var data = new TheoryData<string, string>();
        foreach (var rule in Rules.Keys)
        {
            foreach (var link in pick(Cases.Value.Set(rule)))
            {
                data.Add(rule, link);
            }
        }

        return data;
    }

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "site-link-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The link case file is empty.");
    }

    private sealed record RuleCases(List<string> Accept, List<string> Refuse);

    private sealed record CaseFile(
        string Note,
        RuleCases Messenger,
        RuleCases Facebook,
        RuleCases Instagram,
        RuleCases Tiktok,
        RuleCases Directions,
        RuleCases Embed,
        List<string> RefuseEverywhere)
    {
        public RuleCases Set(string rule) => rule switch
        {
            "messenger" => Messenger,
            "facebook" => Facebook,
            "instagram" => Instagram,
            "tiktok" => Tiktok,
            "directions" => Directions,
            "embed" => Embed,
            _ => throw new ArgumentOutOfRangeException(nameof(rule), rule, "Unknown link rule."),
        };
    }
}
