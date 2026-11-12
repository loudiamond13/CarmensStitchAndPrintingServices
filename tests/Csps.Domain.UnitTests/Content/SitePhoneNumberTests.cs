using Csps.Domain.Content;

namespace Csps.Domain.UnitTests.Content;

public sealed class SitePhoneNumberTests
{
    private static readonly DateTimeOffset Now = new(2026, 11, 11, 10, 0, 0, TimeSpan.Zero);

    [Fact]
    public void ANumberIsKeptInE164FormWithItsLabelMainFlagAndPosition()
    {
        var result = SitePhoneNumber.Create("0917 123 4567", "Globe", isMain: true, position: 0, Now);

        var phone = result.Value;
        phone.Number.ShouldBe("+639171234567");
        phone.Label.ShouldBe("Globe");
        phone.IsMain.ShouldBeTrue();
        phone.Position.ShouldBe(0);
        phone.Id.ShouldNotBe(Guid.Empty);
        phone.CreatedAtUtc.ShouldBe(Now);
        phone.CreatedById.ShouldBeNull();
        phone.UpdatedAtUtc.ShouldBeNull();
        phone.UpdatedById.ShouldBeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ABlankLabelBecomesNone(string? label)
    {
        SitePhoneNumber.Create("02 8123 4567", label, isMain: false, position: 1, Now).Value.Label.ShouldBeNull();
    }

    [Fact]
    public void ALabelIsTrimmedAndTwentyCharactersFit()
    {
        var label = new string('g', SitePhoneNumber.LabelMaxLength);

        SitePhoneNumber.Create("02 8123 4567", $"  {label}  ", isMain: false, position: 1, Now).Value.Label.ShouldBe(label);
    }

    [Fact]
    public void ALabelOverTwentyCharactersIsRefusedOnTheLabelField()
    {
        var result = SitePhoneNumber.Create("02 8123 4567", new string('g', SitePhoneNumber.LabelMaxLength + 1), isMain: false, position: 1, Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()["label"].ShouldBe(["Keep the label to 20 characters or fewer."]);
    }

    [Theory]
    [InlineData("")]
    [InlineData("[0917 000 0000]")]
    [InlineData("12345")]
    public void ANumberThatIsNotAPhilippineNumberIsRefusedOnTheNumberField(string number)
    {
        var result = SitePhoneNumber.Create(number, null, isMain: false, position: 0, Now);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()["number"].ShouldBe([PhilippinePhone.InvalidMessage]);
    }

    [Fact]
    public void BothFieldsAreReportedWhenBothAreWrong()
    {
        var result = SitePhoneNumber.Create("nope", new string('g', 21), isMain: false, position: 0, Now);

        result.Error.FieldErrors.ShouldNotBeNull().Keys.ShouldBe(["number", "label"], ignoreOrder: true);
    }

    [Fact]
    public void TheLimitsMatchTheDesign()
    {
        SitePhoneNumber.NumberMaxLength.ShouldBe(16);
        SitePhoneNumber.LabelMaxLength.ShouldBe(20);
        SitePhoneNumber.MaxCount.ShouldBe(4);
    }

    [Fact]
    public void ARowIsAnAttributedPublicContentRecord()
    {
        var phone = SitePhoneNumber.Create("0917 123 4567", null, isMain: true, position: 0, Now).Value;

        phone.ShouldBeAssignableTo<Csps.Domain.Common.IAttributedRecord>();
        phone.ShouldBeAssignableTo<IPublicContentRecord>();
    }
}
