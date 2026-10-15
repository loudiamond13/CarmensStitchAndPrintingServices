using System.Text.Json;
using Csps.Domain.Identity;

namespace Csps.Domain.UnitTests.Identity;

/// <summary>
/// D-11: the length and composition rule must give the verdict of every case in the shared file that the web suite
/// (web/src/utils/passwordRules.golden.test.ts) also checks. The file is only read here.
/// </summary>
public sealed class PasswordPolicyTests
{
    private static readonly Lazy<CaseFile> Cases = new(Load);

    private static readonly Dictionary<string, PasswordRuleFailure> Failures = new(StringComparer.Ordinal)
    {
        ["empty"] = PasswordRuleFailure.Empty,
        ["too-short"] = PasswordRuleFailure.TooShort,
        ["too-long"] = PasswordRuleFailure.TooLong,
        ["control-character"] = PasswordRuleFailure.ControlCharacter,
        ["no-number"] = PasswordRuleFailure.NoNumber,
        ["no-symbol"] = PasswordRuleFailure.NoSymbol,
        ["contains-personal-info"] = PasswordRuleFailure.ContainsPersonalInfo,
    };

    /// <summary>Every composition-mode case id in the shared file.</summary>
    public static TheoryData<string> CompositionCaseIds => IdsOf("composition");

    [Fact]
    public void PinsTheSharedFileKindAndVersion()
    {
        Cases.Value.Version.ShouldBe(1);
        Cases.Value.Kind.ShouldBe("csps-password-policy-cases");
        Cases.Value.Cases.Select(c => c.Id).Distinct(StringComparer.Ordinal).Count().ShouldBe(Cases.Value.Cases.Count);
    }

    /// <summary>Every full-mode case id in the shared file.</summary>
    public static TheoryData<string> FullCaseIds => IdsOf("full");

    [Fact]
    public void HasAtLeast7FullCases()
    {
        Cases.Value.Cases.Count(c => c.Mode == "full").ShouldBeGreaterThanOrEqualTo(7);
    }

    [Fact]
    public void HasAtLeast14CompositionCases()
    {
        Cases.Value.Cases.Count(c => c.Mode == "composition").ShouldBeGreaterThanOrEqualTo(14);
    }

    [Fact]
    public void LimitsAreEightAndSixtyFour()
    {
        PasswordPolicy.MinLength.ShouldBe(8);
        PasswordPolicy.MaxLength.ShouldBe(64);
    }

    [Theory]
    [MemberData(nameof(CompositionCaseIds))]
    public void CheckCompositionMatchesTheSharedCase(string caseId)
    {
        var shared = Cases.Value.Cases.Single(c => c.Id == caseId);

        PasswordPolicy.CheckComposition(shared.Password).ShouldBe(ExpectedOf(shared), shared.Note);
    }

    [Theory]
    [MemberData(nameof(FullCaseIds))]
    public void CheckMatchesTheSharedCase(string caseId)
    {
        var shared = Cases.Value.Cases.Single(c => c.Id == caseId);
        var personal = shared.Personal!;

        PasswordPolicy.Check(shared.Password, new PersonalInfo(personal.Email, personal.FirstName, personal.LastName))
            .ShouldBe(ExpectedOf(shared), shared.Note);
    }

    [Fact]
    public void CheckIsStricterThanCompositionForPersonalInformation()
    {
        var shared = Cases.Value.Cases.Single(c => c.Id == "personal-composition-mode");
        var personal = shared.Personal!;

        PasswordPolicy.CheckComposition(shared.Password).ShouldBeNull();
        PasswordPolicy.Check(shared.Password, new PersonalInfo(personal.Email, personal.FirstName, personal.LastName))
            .ShouldBe(PasswordRuleFailure.ContainsPersonalInfo);
    }

    [Fact]
    public void MessageForMatchesTheSharedMessageTable()
    {
        Cases.Value.Messages.Count.ShouldBe(Failures.Count);
        foreach (var (key, message) in Cases.Value.Messages)
        {
            PasswordPolicy.MessageFor(Failures[key]).ShouldBe(message, key);
        }
    }

    [Fact]
    public void MessageForRefusesAnUnknownFailure()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => PasswordPolicy.MessageFor((PasswordRuleFailure)99));
    }

    [Fact]
    public void PersonalInfoMinPartLengthIsThree()
    {
        PasswordPolicy.PersonalInfoMinPartLength.ShouldBe(3);
    }

    [Fact]
    public void LengthCountsAnEmojiAsOne()
    {
        PasswordPolicy.Length("\U0001F600").ShouldBe(1);
        PasswordPolicy.Length("\U0001F600\U0001F600a").ShouldBe(3);
    }

    [Fact]
    public void LengthTreatsComposedAndDecomposedAlike()
    {
        var composed = "caf\u00e9";
        var decomposed = "cafe\u0301";

        PasswordPolicy.Length(composed).ShouldBe(4);
        PasswordPolicy.Length(decomposed).ShouldBe(4);
    }

    [Fact]
    public void NormalizeGivesTheComposedFormAndIsIdempotent()
    {
        var once = PasswordPolicy.Normalize("cafe\u0301");

        once.ShouldBe("caf\u00e9");
        PasswordPolicy.Normalize(once).ShouldBe(once);
    }

    private static PasswordRuleFailure? ExpectedOf(PasswordCase shared) =>
        shared.Expected == "ok" ? null : Failures[shared.Expected];

    private static TheoryData<string> IdsOf(string mode)
    {
        var data = new TheoryData<string>();
        foreach (var shared in Cases.Value.Cases.Where(c => c.Mode == mode))
        {
            data.Add(shared.Id);
        }

        return data;
    }

    private static CaseFile Load()
    {
        var path = Path.Combine(AppContext.BaseDirectory, "Fixtures", "password-policy-cases.json");
        return JsonSerializer.Deserialize<CaseFile>(File.ReadAllText(path), StrictOptions)
            ?? throw new InvalidOperationException("The password case file is empty.");
    }

    // Fails closed: a renamed, missing or unknown member is an error, never a silent default.
    private static readonly JsonSerializerOptions StrictOptions = new(JsonSerializerOptions.Web)
    {
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
    };

    private sealed record CaseFile(int Version, string Kind, Dictionary<string, string> Messages, List<PasswordCase> Cases);

    private sealed record PasswordCase(string Id, string Note, string Password, CasePersonal? Personal, string Mode, string Expected);

    private sealed record CasePersonal(string Email, string? FirstName, string? LastName);
}
