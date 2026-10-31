using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of discount rules for the New Order form and the discount routes (OR-3, D-15, ORD-05): a kind of fixed or
/// percentage, a value from 0.01 to 1,000,000.00 (fixed) or above 0 and up to 100 (percentage) with at most two decimal places,
/// and a reason of 1 to 100 characters. Whether the discounts fit under the items total needs the order and runs in the domain.
/// </summary>
public sealed class OrderDiscountFieldsValidator : AbstractValidator<IOrderDiscountFields>
{
    /// <summary>Creates the validator.</summary>
    public OrderDiscountFieldsValidator()
    {
        RuleFor(discount => discount.Kind)
            .Must(static text => DiscountKindNames.TryParse(text, out _)).WithMessage(OrderRules.DiscountKindInvalid);

        RuleFor(discount => discount.Value)
            .Cascade(CascadeMode.Stop)
            .Must(static value => value is not null).WithMessage(OrderRules.DiscountValueRequired)
            .Custom(CheckRange)
            .Must(static value => OrderRules.HasValidScale(value!.Value)).WithMessage(OrderRules.MoneyDecimals);

        RuleFor(discount => discount.Reason)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(OrderRules.DiscountReasonRequired)
            .Must(static text => text!.Trim().Length <= OrderRules.DiscountReasonMaxLength).WithMessage(OrderRules.DiscountReasonTooLong);
    }

    // The range depends on the kind. A missing or unknown kind has its own message, so the value is not judged against a guess.
    private static void CheckRange(decimal? value, ValidationContext<IOrderDiscountFields> context)
    {
        if (!DiscountKindNames.TryParse(context.InstanceToValidate.Kind, out var kind))
        {
            return;
        }

        var fixedKind = kind == DiscountKind.Fixed;
        var limit = fixedKind ? OrderRules.FixedDiscountMax : OrderRules.PercentMax;
        if (value <= 0m || value > limit)
        {
            context.AddFailure(fixedKind ? OrderRules.FixedDiscountOutOfRange : OrderRules.PercentDiscountOutOfRange);
        }
    }
}
