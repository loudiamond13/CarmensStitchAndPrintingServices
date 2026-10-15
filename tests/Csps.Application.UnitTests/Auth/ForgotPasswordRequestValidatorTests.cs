using Csps.Application.Auth;

namespace Csps.Application.UnitTests.Auth;

/// <summary>AUTH-08: the forgot-password form reuses the sign-in email rule and messages.</summary>
public sealed class ForgotPasswordRequestValidatorTests
{
    private readonly ForgotPasswordRequestValidator _validator = new();

    [Theory]
    [InlineData("name@gmail.com")]
    [InlineData("  name@gmail.com  ")]
    [InlineData("paolo.reyes+shop@example.co.ph")]
    public void AShapedEmailPasses(string email) =>
        _validator.Validate(new ForgotPasswordRequest(email)).IsValid.ShouldBeTrue();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingEmailGetsTheRequiredMessage(string? email) =>
        _validator.Validate(new ForgotPasswordRequest(email)).Errors.Select(failure => failure.ErrorMessage)
            .ShouldBe(["Enter your email."]);

    [Theory]
    [InlineData("name")]
    [InlineData("@gmail.com")]
    [InlineData("name@")]
    [InlineData("a@b@c")]
    public void AMalformedEmailGetsTheFormatMessage(string email) =>
        _validator.Validate(new ForgotPasswordRequest(email)).Errors.Select(failure => failure.ErrorMessage)
            .ShouldBe(["Enter a valid email, like name@gmail.com"]);

    [Fact]
    public void AnEmailOver256CharactersIsRejected() =>
        _validator.Validate(new ForgotPasswordRequest(new string('a', 250) + "@b.com")).IsValid.ShouldBeFalse();

    [Fact]
    public void TheEmptyRequestFailsOnTheEmailAlone() =>
        _validator.Validate(ForgotPasswordRequest.Empty).Errors.Select(failure => failure.PropertyName).ShouldBe(["Email"]);

    [Fact]
    public void ToStringNeverPrintsTheEmail() =>
        new ForgotPasswordRequest("paolo@example.com").ToString().ShouldBe(nameof(ForgotPasswordRequest));
}
