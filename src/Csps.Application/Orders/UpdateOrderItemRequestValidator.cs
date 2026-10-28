using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Edit Item form with the item rules the New Order form uses (<see cref="OrderItemFieldsValidator"/>) plus the version:
/// base64 of exactly eight bytes, or the plain "Reload the form" message.
/// </summary>
public sealed class UpdateOrderItemRequestValidator : AbstractValidator<UpdateOrderItemRequest>
{
    /// <summary>Creates the validator.</summary>
    public UpdateOrderItemRequestValidator()
    {
        Include(new OrderItemFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
