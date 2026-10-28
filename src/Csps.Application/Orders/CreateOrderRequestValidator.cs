using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Checks the New Order form with the rules the browser also applies (OR-3), held in <see cref="OrderDetailsFieldsValidator"/> and
/// <see cref="OrderItemFieldsValidator"/> so the edit forms say the same words. It adds the status rule (D-22), the item count
/// (1 to 100), the discounts (none to 20, each checked by <see cref="OrderDiscountFieldsValidator"/>) and the payments (none to 100,
/// each checked by <see cref="OrderPaymentFieldsValidator"/>, with the business today in the validation context under
/// <see cref="OrderPaymentFieldsValidator.TodayKey"/>) and the order expenses (none to 100, each checked by
/// <see cref="OrderExpenseFieldsValidator"/>, with the same business today). Whether the product types, payment methods, receivers,
/// expense categories and payers exist and may be chosen needs the database and runs in the handler; whether the payments fit the
/// total runs in the domain.
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

        RuleFor(request => request.Payments)
            .Must(static payments => payments is null || payments.Count <= OrderRules.MaxPayments).WithMessage(OrderRules.PaymentsTooMany);

        RuleForEach(request => request.Payments)
            .NotNull().WithMessage(OrderRules.PaymentRequired)
            .SetValidator(new PaymentValidator());

        RuleFor(request => request.Expenses)
            .Must(static expenses => expenses is null || expenses.Count <= OrderRules.MaxExpenses).WithMessage(OrderRules.ExpensesTooMany);

        RuleForEach(request => request.Expenses)
            .NotNull().WithMessage(OrderRules.ExpenseRequired)
            .SetValidator(new ExpenseValidator());
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

    private sealed class PaymentValidator : AbstractValidator<OrderPaymentRequest>
    {
        public PaymentValidator() => Include(new OrderPaymentFieldsValidator());
    }

    private sealed class ExpenseValidator : AbstractValidator<OrderExpenseRequest>
    {
        public ExpenseValidator() => Include(new OrderExpenseFieldsValidator());
    }
}
