using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the New Order form with the rules the browser also applies (OR-3), held in <see cref="OrderDetailsFieldsValidator"/> and
/// <see cref="OrderItemFieldsValidator"/> so the edit forms say the same words. It adds the status rule (D-22), the item count
/// (1 to 100) and the discounts (none to 20, each checked by <see cref="OrderDiscountFieldsValidator"/>). Whether the product types exist and may be chosen needs the database and runs in the handler.
/// </summary>
public sealed class CreateOrderRequestValidator : AbstractValidator<CreateOrderRequest>
{
    /// <summary>Creates the validator.</summary>
    public CreateOrderRequestValidator()
    {
        Include(new OrderDetailsFieldsValidator());

        RuleFor(request => request.Status).Custom(CheckStatus);

        RuleFor(request => request.Items)
            .Cascade(CascadeMode.Stop)
            .Must(static items => items is { Count: > 0 }).WithMessage(OrderRules.ItemsRequired)
            .Must(static items => items!.Count <= OrderRules.MaxItems).WithMessage(OrderRules.ItemsTooMany);

        RuleForEach(request => request.Items)
            .NotNull().WithMessage(OrderRules.ItemRequired)
            .SetValidator(new ItemValidator());

        RuleFor(request => request.Discounts)
            .Must(static discounts => discounts is null || discounts.Count <= OrderRules.MaxDiscounts).WithMessage(OrderRules.DiscountsTooMany);

        RuleForEach(request => request.Discounts)
            .NotNull().WithMessage(OrderRules.DiscountRequired)
            .SetValidator(new DiscountValidator());
    }

    private static void CheckStatus(string? text, ValidationContext<CreateOrderRequest> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        if (!OrderStatusNames.TryParse(text, out var status))
        {
            context.AddFailure(OrderRules.StatusInvalid);
        }
        else if (!OrderStatusRules.IsActive(status))
        {
            context.AddFailure(OrderRules.StatusNotActive);
        }
    }

    private sealed class ItemValidator : AbstractValidator<OrderItemRequest>
    {
        public ItemValidator() => Include(new OrderItemFieldsValidator());
    }

    private sealed class DiscountValidator : AbstractValidator<OrderDiscountRequest>
    {
        public DiscountValidator() => Include(new OrderDiscountFieldsValidator());
    }
}
