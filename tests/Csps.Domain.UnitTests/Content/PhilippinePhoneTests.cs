using System.Text.Json;
using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

/// <summary>
/// D-23, PUB-06: parse, E.164 and display of Philippine numbers. The cases come from the shared file that the web
/// zod test also reads (tests/fixtures/philippine-phone-cases.json). The file is only read here.
/// </summary>
public sealed class PhilippinePhoneTests
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

    [Theory]
    [MemberData(nameof(AcceptCases))]
    public void TryParseGivesTheE164AndDisplayOfTheSharedCase(string input, string e164, string display)
    {
        PhilippinePhone.TryParse(input, out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        phone.E164.ShouldBe(e164);
        phone.Display.ShouldBe(display);
    }

    [Fact]
    public void AMobileNumberIsMobile()
    {
        PhilippinePhone.TryParse("0917 123 4567", out var phone).ShouldBeTrue();

        phone.ShouldNotBeNull();
        phone.IsMobile.ShouldBeTrue();
    }

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "philippine-phone-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The phone case file is empty.");
    }

    private sealed record CaseFile(List<AcceptCase> Accept, List<string> Refuse);

    private sealed record AcceptCase(string Input, string E164, string Display);
}
