using System.Text.Json;
using System.Text.RegularExpressions;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// D-23, PUB-06: parse, E.164 and display of Philippine numbers. The cases come from the shared file that the web
/// zod test also reads (tests/fixtures/philippine-phone-cases.json). The file is only read here.
/// </summary>
public sealed partial class PhilippinePhoneTests
{
    private static readonly Lazy<CaseFile> Cases = new(Load);

    // Fails closed: a renamed, missing or unknown member is an error, never a silent default.
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    /// <summary>Every accept case in the shared file.</summary>
    public static TheoryData<string, string, string> AcceptCases
    {
        get
        {
            var data = new TheoryData<string, string, string>();
            foreach (var accepted in Cases.Value.Accept)
            {
                data.Add(accepted.Input, accepted.E164, accepted.Display);
            }

            return data;
        }
    }

    /// <summary>Every refuse case in the shared file.</summary>
    public static TheoryData<string> RefuseCases
    {
        get
        {
            var data = new TheoryData<string>();
            foreach (var refused in Cases.Value.Refuse)
            {
                data.Add(refused);
            }

            return data;
        }
    }

    [Theory]
    [MemberData(nameof(AcceptCases))]
    public void TryParseGivesTheE164AndDisplayOfTheSharedCase(string input, string e164, string display)
    {
        PhilippinePhone.TryParse(input, out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        phone.E164.ShouldBe(e164);
        phone.Display.ShouldBe(display);
    }

    [Theory]
    [MemberData(nameof(AcceptCases))]
    public void TheE164HoldsOnlyAPlusAndDigits(string input, string e164, string display)
    {
        PhilippinePhone.TryParse(input, out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        E164Shape().IsMatch(phone.E164).ShouldBeTrue();
        e164.ShouldNotBeNullOrEmpty();
        display.ShouldNotBeNullOrEmpty();
    }

    [Theory]
    [MemberData(nameof(AcceptCases))]
    public void ParsingTheDisplayFormGivesTheSameNumber(string input, string e164, string display)
    {
        PhilippinePhone.TryParse(input, out var typed).ShouldBeTrue();
        PhilippinePhone.TryParse(display, out var shown).ShouldBeTrue();

        shown.ShouldBe(typed);
        shown.ShouldNotBeNull();
        shown.E164.ShouldBe(e164);
    }

    [Theory]
    [MemberData(nameof(RefuseCases))]
    public void TryParseRefusesTheSharedCase(string input)
    {
        PhilippinePhone.TryParse(input, out var phone).ShouldBeFalse();

        phone.ShouldBeNull();
    }

    [Fact]
    public void TryParseRefusesNull()
    {
        PhilippinePhone.TryParse(null, out var phone).ShouldBeFalse();

        phone.ShouldBeNull();
    }

    [Fact]
    public void AMobileNumberIsMobile()
    {
        PhilippinePhone.TryParse("0917 123 4567", out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        phone.IsMobile.ShouldBeTrue();
    }

    [Theory]
    [InlineData("(02) 8123 4567")]
    [InlineData("088 123 4567")]
    public void ALandlineIsNotMobile(string input)
    {
        PhilippinePhone.TryParse(input, out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        phone.IsMobile.ShouldBeFalse();
    }

    [Theory]
    [InlineData("0917 123 4567", "+639171234567")]
    [InlineData("0917-123-4567", "+63 (917) 123 4567")]
    [InlineData("(02) 8123 4567", "+63 2 8123 4567")]
    public void NumbersThatDifferOnlyInSpacingOrZeroVersusPlus63AreEqual(string first, string second)
    {
        PhilippinePhone.TryParse(first, out var a).ShouldBeTrue();
        PhilippinePhone.TryParse(second, out var b).ShouldBeTrue();

        a.ShouldBe(b);
        a.ShouldNotBeNull();
        a.E164.ShouldBe(b?.E164);
    }

    [Fact]
    public void DifferentNumbersAreNotEqual()
    {
        PhilippinePhone.TryParse("0917 123 4567", out var a).ShouldBeTrue();
        PhilippinePhone.TryParse("0917 123 4568", out var b).ShouldBeTrue();

        a.ShouldNotBe(b);
    }

    [Fact]
    public void TheLimitAndTheMessageAreThoseOfTheUiSpec()
    {
        PhilippinePhone.MaxInputLength.ShouldBe(32);
        PhilippinePhone.InvalidMessage.ShouldBe("Enter a phone number, like 0917 123 4567 or 02 8123 4567.");
    }

    [Fact]
    public void TheSharedFileTestsTheLengthLimitOnBothSides()
    {
        Cases.Value.Accept.ShouldContain(c => c.Input.Length == PhilippinePhone.MaxInputLength);
        Cases.Value.Refuse.ShouldContain(c => c.Length == PhilippinePhone.MaxInputLength + 1);
    }

    [Fact]
    public void TheSharedFileHoldsAnAcceptedNumberOfEveryShape()
    {
        Cases.Value.Accept.ShouldContain(c => c.Display == "0917 123 4567");
        Cases.Value.Accept.ShouldContain(c => c.Display == "02 8123 4567");
        Cases.Value.Accept.ShouldContain(c => c.Display == "088 123 4567");
        Cases.Value.Refuse.ShouldContain("[0917 000 0000]");
    }

    [GeneratedRegex(@"^\+[0-9]+$", RegexOptions.None, matchTimeoutMilliseconds: 1000)]
    private static partial Regex E164Shape();

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "philippine-phone-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The phone case file is empty.");
    }

    private sealed record CaseFile(List<AcceptCase> Accept, List<string> Refuse);

    private sealed record AcceptCase(string Input, string E164, string Display);
}
