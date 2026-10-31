using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Add Payment form with the payment rules the New Order form uses (<see cref="OrderPaymentFieldsValidator"/>) plus the
/// version: base64 of exactly eight bytes, or the plain "Reload the form" message. The business today travels in the validation
/// context under <see cref="OrderPaymentFieldsValidator.TodayKey"/>.
/// </summary>
public sealed class AddOrderPaymentRequestValidator : AbstractValidator<AddOrderPaymentRequest>
{
    /// <summary>Creates the validator.</summary>
    public AddOrderPaymentRequestValidator()
    {
        Include(new OrderPaymentFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
