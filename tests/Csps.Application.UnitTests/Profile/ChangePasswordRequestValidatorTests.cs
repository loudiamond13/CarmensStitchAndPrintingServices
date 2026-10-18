using Csps.Application.Profile;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Profile;

/// <summary>PROF-03, OR-3: the password form rules the web form mirrors; the name, email and breach rules need the account and run in the handler.</summary>
public sealed class ChangePasswordRequestValidatorTests
{
    private const string Current = "Tala#Bituin2025";
    private const string Good = "Mabuhay#Tahi2026";

    private readonly ChangePasswordRequestValidator _validator = new();

    [Fact]
    public void AValidFormPasses()
    {
        Check(Current, Good).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void AMissingCurrentPasswordIsRefusedWithOneMessage(string? current)
    {
        Messages(Check(current, Good), "CurrentPassword").ShouldBe([ChangePasswordRequestValidator.CurrentPasswordRequired]);
    }

    [Fact]
    public void ACurrentPasswordIsNotHeldToTheCompositionRule()
    {
        // An older password may pre-date the rule; only the new one is held to it.
        Check("old", Good).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null, "Enter a new password.")]
    [InlineData("", "Enter a new password.")]
    [InlineData("a1!", "Use at least 8 characters.")]
    [InlineData("abcdefg1", "Add at least one symbol, like ! or #.")]
    [InlineData("abcdefg!", "Add at least one number.")]
    [InlineData("abc\tdef1!", "Remove tabs and line breaks from your password.")]
    public void ANewPasswordThatBreaksARuleIsRefusedWithThatMessage(string? password, string message)
    {
        Messages(Check(Current, password), "NewPassword").ShouldBe([message]);
    }

    [Fact]
    public void TheLengthLimitsAreEightAndSixtyFourCodePoints()
    {
        Check(Current, new string('a', 6) + "1!").IsValid.ShouldBeTrue();
        Messages(Check(Current, new string('a', 5) + "1!"), "NewPassword").ShouldBe(["Use at least 8 characters."]);
        Check(Current, new string('a', 62) + "1!").IsValid.ShouldBeTrue();

        Messages(Check(Current, new string('a', 63) + "1!"), "NewPassword").ShouldBe(["Use 64 characters or fewer."]);
    }

    [Fact]
    public void LengthCountsCodePointsNotUtf16Units()
    {
        // 31 emoji (two UTF-16 units each) plus "1!" is 33 code points, well inside the limit.
        Check(Current, string.Concat(Enumerable.Repeat("\U0001F600", 31)) + "1!").IsValid.ShouldBeTrue();
    }

    [Fact]
    public void AnEmptyRequestReportsBothFields()
    {
        var result = _validator.Validate(ChangePasswordRequest.Empty);

        Messages(result, "CurrentPassword").ShouldBe([ChangePasswordRequestValidator.CurrentPasswordRequired]);
        Messages(result, "NewPassword").ShouldBe(["Enter a new password."]);
    }

    private static string[] Messages(ValidationResult result, string property) =>
        [.. result.Errors.Where(error => error.PropertyName == property).Select(static error => error.ErrorMessage)];

    private ValidationResult Check(string? current, string? next) => _validator.Validate(new ChangePasswordRequest(current, next));
}
