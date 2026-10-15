using Csps.Application.Auth;

namespace Csps.Application.UnitTests.Auth;

/// <summary>UI-SPEC S1: the sign-in form is checked for shape only, never for password strength.</summary>
public sealed class SignInRequestValidatorTests
{
    private readonly SignInRequestValidator _validator = new();

    [Theory]
    [InlineData("name@gmail.com")]
    [InlineData("  name@gmail.com  ")]
    [InlineData("a@b")]
    [InlineData("paolo.reyes+shop@example.co.ph")]
    public void AShapedEmailPasses(string email) =>
        _validator.Validate(new SignInRequest(email, "x", true)).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingEmailGetsOnlyTheRequiredMessage(string? email)
    {
        var result = _validator.Validate(new SignInRequest(email, "x", true));

        result.Errors.Where(failure => failure.PropertyName == "Email").Select(failure => failure.ErrorMessage)
            .ShouldBe(["Enter your email."]);
    }

    [Theory]
    [InlineData("name")]
    [InlineData("@gmail.com")]
    [InlineData("name@")]
    [InlineData("a@b@c")]
    public void AMalformedEmailGetsTheFormatMessage(string email)
    {
        var result = _validator.Validate(new SignInRequest(email, "x", true));

        result.Errors.Where(failure => failure.PropertyName == "Email").Select(failure => failure.ErrorMessage)
            .ShouldBe(["Enter a valid email, like name@gmail.com"]);
    }

    [Fact]
    public void TheEmailLengthCapIs256()
    {
        var atCap = new string('a', 250) + "@b.com";
        var overCap = new string('a', 251) + "@b.com";

        atCap.Length.ShouldBe(256);
        _validator.Validate(new SignInRequest(atCap, "x", true)).IsValid.ShouldBeTrue();
        _validator.Validate(new SignInRequest(overCap, "x", true)).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void AMissingPasswordIsReported(string? password)
    {
        var result = _validator.Validate(new SignInRequest("name@gmail.com", password, true));

        result.Errors.ShouldHaveSingleItem().ErrorMessage.ShouldBe("Enter your password.");
    }

    [Theory]
    [InlineData("x")]
    [InlineData("short")]
    [InlineData("   ")]
    public void AnyOtherPasswordPassesBecauseLegacyPasswordsMustStillWork(string password) =>
        _validator.Validate(new SignInRequest("name@gmail.com", password, true)).IsValid.ShouldBeTrue();
}
