using Csps.Application.Common;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the Add Refund form with the refund rules (<see cref="OrderRefundFieldsValidator"/>) plus the version: base64 of exactly
/// eight bytes, or the plain "Reload the form" message. The business today travels in the validation context under
/// <see cref="OrderRefundFieldsValidator.TodayKey"/>.
/// </summary>
public sealed class AddOrderRefundRequestValidator : AbstractValidator<AddOrderRefundRequest>
{
    /// <summary>Creates the validator.</summary>
    public AddOrderRefundRequestValidator()
    {
        Include(new OrderRefundFieldsValidator());

        RuleFor(request => request.Version)
            .Must(static text => RowVersions.TryParse(text, out _)).WithMessage(RowVersions.InvalidMessage);
    }
}
