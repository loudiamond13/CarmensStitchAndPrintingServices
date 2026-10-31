using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of refund rules for the refund routes (OR-3, ORD-05, ORD-18, D-30): a real <c>yyyy-MM-dd</c> date never after the
/// business today, an amount above 0.00 and at most 1,000,000.00 with at most two decimal places, a reason of 1 to 200 characters,
/// and who handed the money back. The business today is passed in <see cref="ValidationContext{T}.RootContextData"/> under
/// <see cref="TodayKey"/>. Whether the refunder exists and may be chosen needs the database, and whether the amount fits the caps
/// needs the order; they run in the handlers and the domain.
/// </summary>
public sealed class OrderRefundFieldsValidator : AbstractValidator<IOrderRefundFields>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = OrderPaymentFieldsValidator.TodayKey;

    /// <summary>Creates the validator.</summary>
    public OrderRefundFieldsValidator()
    {
        RuleFor(refund => refund.RefundDate).Custom(CheckDate);

        RuleFor(refund => refund.Amount)
            .Cascade(CascadeMode.Stop)
            .Must(static amount => amount is not null).WithMessage(OrderRules.PaymentAmountRequired)
            .Must(static amount => amount > 0m && amount <= OrderRules.PaymentAmountMax).WithMessage(OrderRules.PaymentAmountOutOfRange)
            .Must(static amount => OrderRules.HasValidScale(amount!.Value)).WithMessage(OrderRules.MoneyDecimals);

        RuleFor(refund => refund.Reason)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(OrderRules.RefundReasonRequired)
            .Must(static text => text!.Trim().Length <= OrderRules.RefundReasonMaxLength).WithMessage(OrderRules.RefundReasonTooLong);

        RuleFor(refund => refund.RefundedByUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.RefundedByRequired);
    }

    private static void CheckDate(string? text, ValidationContext<IOrderRefundFields> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(OrderRules.RefundDateRequired);
            return;
        }

        if (!OrderDetailsFieldsValidator.TryParseDate(text, out var date))
        {
            context.AddFailure(OrderRules.DateInvalid);
            return;
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var today) || today is not DateOnly businessToday)
        {
            throw new InvalidOperationException($"The refund validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        if (date > businessToday)
        {
            context.AddFailure(OrderRules.RefundDateInFuture);
        }
    }
}
