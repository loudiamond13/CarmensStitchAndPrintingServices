using Csps.Application.Profile;

namespace Csps.Application.UnitTests.Profile;

/// <summary>PROF-01, SEC-07, OR-3: the name form rules the web form mirrors, counted in UTF-16 units after trimming.</summary>
public sealed class UpdateProfileNameRequestValidatorTests
{
    private const string GoodVersion = "9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72";

    private readonly UpdateProfileNameRequestValidator _validator = new();

    [Fact]
    public void AValidFormPasses()
    {
        Check("Ana", "Cruz", GoodVersion).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t \r\n")]
    public void ABlankFirstNameIsRefusedWithOneMessage(string? firstName)
    {
        Messages(Check(firstName, "Cruz", GoodVersion), "FirstName").ShouldBe([UpdateProfileNameRequestValidator.FirstNameRequired]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData(" \t ")]
    public void ABlankLastNameIsRefusedWithOneMessage(string? lastName)
    {
        Messages(Check("Ana", lastName, GoodVersion), "LastName").ShouldBe([UpdateProfileNameRequestValidator.LastNameRequired]);
    }

    [Fact]
    public void ExactlyOneHundredCharactersPassAndOneHundredAndOneAreRefused()
    {
        Check(new string('a', 100), new string('b', 100), GoodVersion).IsValid.ShouldBeTrue();

        var over = Check(new string('a', 101), new string('b', 101), GoodVersion);

        Messages(over, "FirstName").ShouldBe([UpdateProfileNameRequestValidator.FirstNameTooLong]);
        Messages(over, "LastName").ShouldBe([UpdateProfileNameRequestValidator.LastNameTooLong]);
    }

    [Fact]
    public void LengthIsCountedAfterTrimming()
    {
        Check($"  {new string('a', 100)}  ", $"\t{new string('b', 100)} ", GoodVersion).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void LengthIsCountedInUtf16Units()
    {
        Check(string.Concat(Enumerable.Repeat("\U0001F600", 50)), "Cruz", GoodVersion).IsValid.ShouldBeTrue();
        Check(string.Concat(Enumerable.Repeat("\U0001F600", 51)), "Cruz", GoodVersion).IsValid.ShouldBeFalse();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("not-a-guid")]
    [InlineData("{9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72}")]
    [InlineData("9c2d1e4f7a604b38a1f53d8e6b0c4a72")]
    [InlineData("(9c2d1e4f-7a60-4b38-a1f5-3d8e6b0c4a72)")]
    public void AMissingOrMalformedVersionIsRefused(string? version)
    {
        Messages(Check("Ana", "Cruz", version), "Version").ShouldBe([UpdateProfileNameRequestValidator.VersionInvalid]);
    }

    [Fact]
    public void TheEmptyRequestReportsEveryField()
    {
        var result = _validator.Validate(UpdateProfileNameRequest.Empty);

        result.Errors.Select(static error => error.PropertyName).Order().ShouldBe(["FirstName", "LastName", "Version"]);
    }

    [Fact]
    public void ParsingAcceptsTheDFormOnly()
    {
        UpdateProfileNameRequestValidator.TryParseVersion(GoodVersion, out var parsed).ShouldBeTrue();
        parsed.ShouldBe(Guid.Parse(GoodVersion));
        UpdateProfileNameRequestValidator.TryParseVersion("9c2d1e4f7a604b38a1f53d8e6b0c4a72", out var other).ShouldBeFalse();
        other.ShouldBe(Guid.Empty);
    }

    private FluentValidation.Results.ValidationResult Check(string? firstName, string? lastName, string? version) =>
        _validator.Validate(new UpdateProfileNameRequest(firstName, lastName, version));

    private static IEnumerable<string> Messages(FluentValidation.Results.ValidationResult result, string property) =>
        result.Errors.Where(error => error.PropertyName == property).Select(static error => error.ErrorMessage);
}
