using System.Globalization;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of customer and date rules for the New Order and Edit Order forms (OR-3, D-21), so a save says the same words
/// whichever form sent it: a customer name of 1 to 100 characters, a team name of up to 100, a contact number of up to 30
/// digits, spaces and + - ( ), an email of up to 254 that is a real address, an address of up to 300, notes of up to 2,000, a real
/// <c>yyyy-MM-dd</c> order date, and a due date on or after it. Lengths are counted after trimming, as the browser counts them.
/// </summary>
public sealed class OrderDetailsFieldsValidator : AbstractValidator<IOrderDetailsFields>
{
    /// <summary>Creates the validator.</summary>
    public OrderDetailsFieldsValidator()
    {
        RuleFor(request => request.CustomerName)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(OrderRules.CustomerNameRequired)
            .Must(static text => text!.Trim().Length <= OrderRules.CustomerNameMaxLength).WithMessage(OrderRules.CustomerNameTooLong);

        RuleFor(request => request.TeamName)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.TeamNameMaxLength).WithMessage(OrderRules.TeamNameTooLong);

        RuleFor(request => request.ContactNumber)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(OrderRules.ContactNumberRequired)
            .Must(static text => text!.Trim().Length <= OrderRules.ContactNumberMaxLength).WithMessage(OrderRules.ContactNumberTooLong)
            .Must(static text => OrderRules.IsValidContactNumber(text!.Trim())).WithMessage(OrderRules.ContactNumberInvalid);

        RuleFor(request => request.Email)
            .Cascade(CascadeMode.Stop)
            .Must(static text => string.IsNullOrWhiteSpace(text) || text.Trim().Length <= OrderRules.EmailMaxLength).WithMessage(OrderRules.EmailTooLong)
            .Must(static text => string.IsNullOrWhiteSpace(text) || OrderRules.IsValidEmail(text.Trim())).WithMessage(OrderRules.EmailInvalid);

        RuleFor(request => request.Address)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.AddressMaxLength).WithMessage(OrderRules.AddressTooLong);

        RuleFor(request => request.OrderDate).Custom(CheckOrderDate);
        RuleFor(request => request.DueDate).Custom(CheckDueDate);

        RuleFor(request => request.Notes)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.NotesMaxLength).WithMessage(OrderRules.NotesTooLong);
    }

    /// <summary>Reads a date in <c>yyyy-MM-dd</c> form, ignoring spaces around it.</summary>
    /// <param name="text">The text sent by the form.</param>
    /// <param name="date">The date when the text is a real calendar day.</param>
    /// <returns>True when the text is a real <c>yyyy-MM-dd</c> date.</returns>
    public static bool TryParseDate(string? text, out DateOnly date)
    {
        date = default;
        return text is not null
            && DateOnly.TryParseExact(text.Trim(), OrderRules.DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);
    }

    private static void CheckOrderDate(string? text, ValidationContext<IOrderDetailsFields> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(OrderRules.OrderDateRequired);
        }
        else if (!TryParseDate(text, out _))
        {
            context.AddFailure(OrderRules.DateInvalid);
        }
    }

    // The due date is compared with the order date only when both are real dates; the order date reports its own error.
    private static void CheckDueDate(string? text, ValidationContext<IOrderDetailsFields> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(OrderRules.DueDateRequired);
        }
        else if (!TryParseDate(text, out var due))
        {
            context.AddFailure(OrderRules.DateInvalid);
        }
        else if (TryParseDate(context.InstanceToValidate.OrderDate, out var order) && due < order)
        {
            context.AddFailure(OrderRules.DueDateBeforeOrderDate);
        }
    }
}
