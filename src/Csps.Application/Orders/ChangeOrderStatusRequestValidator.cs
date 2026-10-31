using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>Checks the Change Status action: the status must be one of the seven wire keys.</summary>
public sealed class ChangeOrderStatusRequestValidator : AbstractValidator<ChangeOrderStatusRequest>
{
    /// <summary>Creates the validator.</summary>
    public ChangeOrderStatusRequestValidator()
    {
        RuleFor(request => request.Status)
            .Must(static text => OrderStatusNames.TryParse(text, out _)).WithMessage(OrderRules.StatusInvalid);
    }
}
