using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of payment rules for the New Order form and the payment routes (OR-3, ORD-05, ORD-22, D-30): a real
/// <c>yyyy-MM-dd</c> date never after the business today, an amount above 0.00 and at most 1,000,000.00 with at most two decimal
/// places, a payment method, a reference of up to 100 characters, notes of up to 500, and who received the money. The business
/// today is passed in <see cref="ValidationContext{T}.RootContextData"/> under <see cref="TodayKey"/>. Whether the method and the
/// receiver exist and may be chosen needs the database, and whether the amount fits the balance needs the order; they run in the
/// handlers and the domain.
/// </summary>
public sealed class OrderPaymentFieldsValidator : AbstractValidator<IOrderPaymentFields>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = "today";

    /// <summary>Creates the validator.</summary>
    public OrderPaymentFieldsValidator()
    {
        RuleFor(payment => payment.PaymentDate).Custom(CheckDate);

        RuleFor(payment => payment.Amount)
            .Cascade(CascadeMode.Stop)
            .Must(static amount => amount is not null).WithMessage(OrderRules.PaymentAmountRequired)
            .Must(static amount => amount > 0m && amount <= OrderRules.PaymentAmountMax).WithMessage(OrderRules.PaymentAmountOutOfRange)
            .Must(static amount => OrderRules.HasValidScale(amount!.Value)).WithMessage(OrderRules.MoneyDecimals);

        RuleFor(payment => payment.PaymentMethodId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.PaymentMethodRequired);

        RuleFor(payment => payment.Reference)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.PaymentReferenceMaxLength).WithMessage(OrderRules.PaymentReferenceTooLong);

        RuleFor(payment => payment.Notes)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.PaymentNotesMaxLength).WithMessage(OrderRules.PaymentNotesTooLong);

        RuleFor(payment => payment.ReceivedByUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.ReceivedByRequired);
    }

    private static void CheckDate(string? text, ValidationContext<IOrderPaymentFields> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(OrderRules.PaymentDateRequired);
            return;
        }

        if (!OrderDetailsFieldsValidator.TryParseDate(text, out var date))
        {
            context.AddFailure(OrderRules.DateInvalid);
            return;
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var today) || today is not DateOnly businessToday)
        {
            throw new InvalidOperationException($"The payment validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        if (date > businessToday)
        {
            context.AddFailure(OrderRules.PaymentDateInFuture);
        }
    }
}
