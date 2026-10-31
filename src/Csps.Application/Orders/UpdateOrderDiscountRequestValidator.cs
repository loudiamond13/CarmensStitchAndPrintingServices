using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Edit Discount form with the discount rules the New Order form uses (<see cref="OrderDiscountFieldsValidator"/>) plus
/// the version: base64 of exactly eight bytes, or the plain "Reload the form" message.
/// </summary>
public sealed class UpdateOrderDiscountRequestValidator : AbstractValidator<UpdateOrderDiscountRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateOrderDiscountRequestValidator()
    {
        Include(new OrderDiscountFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
