using Csps.Application.Money;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Money;

/// <summary>MONEY-04, D-20, OR-3: every static rule of the Transfer Money form, each at its limit.</summary>
public sealed class CreateMoneyTransferRequestValidatorTests
{
    private static readonly DateOnly Today = new(2026, 11, 7);
    private static readonly Guid RecipientId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public void AValidFormPasses()
    {
        Validate(Valid()).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void AnEmptyFormListsTheRecipientTheAmountAndTheDateTogetherAndNotTheNote()
    {
        var result = Validate(CreateMoneyTransferRequest.Empty);

        result.Errors.Select(error => error.PropertyName).Order(StringComparer.Ordinal).ShouldBe(["Amount", "ToUserId", "TransferDate"]);
        Messages(result, "ToUserId").ShouldBe(["Choose who got the cash."]);
        Messages(result, "Amount").ShouldBe(["Enter the amount."]);
        Messages(result, "TransferDate").ShouldBe(["Enter the transfer date."]);
    }

    [Fact]
    public void AnEmptyRecipientIdIsRefusedLikeAMissingOne()
    {
        Messages(Validate(Valid() with { ToUserId = Guid.Empty }), "ToUserId").ShouldBe(["Choose who got the cash."]);
    }

    [Theory]
    [InlineData("0.00")]
    [InlineData("-5.00")]
    public void AnAmountBelowOneCentavoIsRefused(string amount)
    {
        Messages(Validate(Valid() with { Amount = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture) }), "Amount")
            .ShouldBe(["Enter an amount of at least ₱0.01."]);
    }

    [Theory]
    [InlineData("0.01")]
    [InlineData("1.5")]
    [InlineData("3200.00")]
    public void OneCentavoAndAnyAmountWithTwoDecimalsAreAccepted(string amount)
    {
        Validate(Valid() with { Amount = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture) }).IsValid.ShouldBeTrue();
    }

    [Theory]
    [InlineData("10.005")]
    [InlineData("0.001")]
    [InlineData("99.999")]
    public void MoreThanTwoDecimalPlacesAreRefused(string amount)
    {
        Messages(Validate(Valid() with { Amount = decimal.Parse(amount, System.Globalization.CultureInfo.InvariantCulture) }), "Amount")
            .ShouldBe(["Use at most 2 decimal places."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void AMissingDateIsRequired(string? date)
    {
        Messages(Validate(Valid() with { TransferDate = date }), "TransferDate").ShouldBe(["Enter the transfer date."]);
    }

    [Theory]
    [InlineData("2026-02-30")]
    [InlineData("2026-13-01")]
    [InlineData("07/11/2026")]
    [InlineData("2026-1-5")]
    [InlineData("tomorrow")]
    public void ADateThatIsNotARealIsoDayIsRefused(string date)
    {
        Messages(Validate(Valid() with { TransferDate = date }), "TransferDate").ShouldBe(["Enter a real date."]);
    }

    [Theory]
    [InlineData("2026-11-07")]
    [InlineData("2025-01-15")]
    [InlineData(" 2026-11-07 ")]
    public void TodayAndAnyPastDayAreAccepted(string date)
    {
        Validate(Valid() with { TransferDate = date }).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void TomorrowIsRefused()
    {
        Messages(Validate(Valid() with { TransferDate = "2026-11-08" }), "TransferDate").ShouldBe(["The transfer date can't be in the future."]);
    }

    [Fact]
    public void ANoteOfTwoHundredCharactersIsAcceptedAndTwoHundredAndOneIsRefused()
    {
        Validate(Valid() with { Note = new string('a', 200) }).IsValid.ShouldBeTrue();
        Messages(Validate(Valid() with { Note = new string('a', 201) }), "Note").ShouldBe(["Keep the note to 200 characters or fewer."]);
    }

    [Fact]
    public void SpacesAroundTheNoteDoNotCountTowardTheLimit()
    {
        Validate(Valid() with { Note = "  " + new string('a', 200) + "  " }).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void ABlankOrMissingNoteIsAccepted()
    {
        Validate(Valid() with { Note = null }).IsValid.ShouldBeTrue();
        Validate(Valid() with { Note = "   " }).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void TheValidatorNeedsTheBusinessToday()
    {
        var context = new ValidationContext<CreateMoneyTransferRequest>(Valid());

        Should.Throw<InvalidOperationException>(() => new CreateMoneyTransferRequestValidator().Validate(context));
    }

    [Fact]
    public void ATodayThatIsNotADateIsRefusedLikeAMissingOne()
    {
        var context = new ValidationContext<CreateMoneyTransferRequest>(Valid());
        context.RootContextData[CreateMoneyTransferRequestValidator.TodayKey] = "2026-11-07";

        Should.Throw<InvalidOperationException>(() => new CreateMoneyTransferRequestValidator().Validate(context));
    }

    private static CreateMoneyTransferRequest Valid() => new(RecipientId, 2000.00m, "2026-11-07", "Cash for the fabric run");

    private static ValidationResult Validate(CreateMoneyTransferRequest request)
    {
        var context = new ValidationContext<CreateMoneyTransferRequest>(request);
        context.RootContextData[CreateMoneyTransferRequestValidator.TodayKey] = Today;
        return new CreateMoneyTransferRequestValidator().Validate(context);
    }

    private static string[] Messages(ValidationResult result, string property) =>
        [.. result.Errors.Where(error => error.PropertyName == property).Select(error => error.ErrorMessage)];
}
