using Csps.Application.Expenses;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.UnitTests.Expenses;

/// <summary>CEXP-02, SEC-07, OQ-10: the Edit Expense form has the Add Expense field rules and a version that is base64 of eight bytes.</summary>
public sealed class UpdateCompanyExpenseRequestValidatorTests
{
    private const string GoodVersion = "AAAAAAAAB9A=";
    private static readonly DateOnly Today = new(2026, 10, 25);
    private static readonly Guid CategoryId = Guid.Parse("447ad32e-1433-4b70-8786-72e3dc3f9937");
    private static readonly Guid PayerId = Guid.Parse("5b8e2c71-4d90-4a3f-8c16-0f7d3a9e6b24");

    [Fact]
    public void AValidFormWithAVersionPasses()
    {
        Validate(Valid()).IsValid.ShouldBeTrue();
    }

    [Fact]
    public void AnEmptyFormListsEveryRequiredFieldAndTheVersion()
    {
        var result = Validate(UpdateCompanyExpenseRequest.Empty);

        result.Errors.Select(error => error.PropertyName).Order(StringComparer.Ordinal)
            .ShouldBe(["Amount", "CategoryId", "Date", "Description", "PaidByUserId", "Version"]);
        Messages(result, "Version").ShouldBe(["Reload the form and try again."]);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not base64!")]
    [InlineData("AAAAAAAAAA==")]
    [InlineData("AAAAAAAAAAAAAAAA")]
    public void AVersionThatIsNotEightBytesOfBase64IsRefused(string? version)
    {
        Messages(Validate(Valid() with { Version = version }), "Version").ShouldBe(["Reload the form and try again."]);
    }

    [Fact]
    public void TheFieldRulesAndMessagesAreTheSameAsTheAddForm()
    {
        var result = Validate(Valid() with
        {
            Date = "2026-11-25",
            CategoryId = Guid.Empty,
            Description = " ",
            Amount = 1000000.01m,
            PaidByUserId = Guid.Empty,
            Notes = new string('n', 1001),
        });

        Messages(result, "Date").ShouldBe(["Choose a date up to 30 days from today, Nov 24, 2026 at the latest."]);
        Messages(result, "CategoryId").ShouldBe(["Choose a category."]);
        Messages(result, "Description").ShouldBe(["Add a short description so others know what this was for."]);
        Messages(result, "Amount").ShouldBe(["Enter an amount of ₱1,000,000.00 or less."]);
        Messages(result, "PaidByUserId").ShouldBe(["Choose who paid."]);
        Messages(result, "Notes").ShouldBe(["Keep notes to 1,000 characters or fewer."]);
        Messages(result, "Version").ShouldBeEmpty();
    }

    private static UpdateCompanyExpenseRequest Valid() => new("2026-10-25", CategoryId, "Thread and needles", 640.00m, PayerId, null, GoodVersion);

    private static ValidationResult Validate(UpdateCompanyExpenseRequest request)
    {
        var context = new ValidationContext<UpdateCompanyExpenseRequest>(request);
        context.RootContextData[UpdateCompanyExpenseRequestValidator.TodayKey] = Today;
        return new UpdateCompanyExpenseRequestValidator().Validate(context);
    }

    private static string[] Messages(ValidationResult result, string property) =>
        [.. result.Errors.Where(error => error.PropertyName == property).Select(error => error.ErrorMessage)];
}
