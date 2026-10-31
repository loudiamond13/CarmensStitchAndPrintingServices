using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Edit Expense form with the expense rules the Add Expense form uses (<see cref="OrderExpenseFieldsValidator"/>) plus
/// the version: base64 of exactly eight bytes, or the plain "Reload the form" message. The business today travels in the
/// validation context under <see cref="OrderExpenseFieldsValidator.TodayKey"/>.
/// </summary>
public sealed class UpdateOrderExpenseRequestValidator : AbstractValidator<UpdateOrderExpenseRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateOrderExpenseRequestValidator()
    {
        Include(new OrderExpenseFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
