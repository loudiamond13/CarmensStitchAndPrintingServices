using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Edit Order details form with the same customer and date rules as the New Order form
/// (<see cref="OrderDetailsFieldsValidator"/>) plus the version: base64 of exactly eight bytes, or the plain "Reload the form" message.
/// </summary>
public sealed class UpdateOrderDetailsRequestValidator : AbstractValidator<UpdateOrderDetailsRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateOrderDetailsRequestValidator()
    {
        Include(new OrderDetailsFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
