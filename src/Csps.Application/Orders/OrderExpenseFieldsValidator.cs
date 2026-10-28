using Csps.Domain.Expenses;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of order expense rules for the New Order form and the expense routes (OR-3, ORD-05, ORD-23, D-30): a real
/// <c>yyyy-MM-dd</c> date that may be any past day and up to 30 days after the business today, an amount above 0.00 and at most
/// 1,000,000.00 with at most two decimal places, a category, a description of up to 200 characters, and who paid. The business
/// today is passed in <see cref="ValidationContext{T}.RootContextData"/> under <see cref="TodayKey"/>. Whether the category and the
/// payer exist and may be chosen needs the database and runs in the handlers.
/// </summary>
public sealed class OrderExpenseFieldsValidator : AbstractValidator<IOrderExpenseFields>
{
    /// <summary>The <see cref="ValidationContext{T}.RootContextData"/> key that holds the business today as a <see cref="DateOnly"/>.</summary>
    public const string TodayKey = OrderPaymentFieldsValidator.TodayKey;

    /// <summary>Creates the validator.</summary>
    public OrderExpenseFieldsValidator()
    {
        RuleFor(expense => expense.ExpenseDate).Custom(CheckDate);

        RuleFor(expense => expense.OrderExpenseCategoryId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.ExpenseCategoryRequired);

        RuleFor(expense => expense.Amount)
            .Cascade(CascadeMode.Stop)
            .Must(static amount => amount is > 0m).WithMessage(ExpenseRules.AmountTooSmall)
            .Must(static amount => amount <= OrderRules.ExpenseAmountMax).WithMessage(ExpenseRules.AmountTooLarge)
            .Must(static amount => OrderRules.HasValidScale(amount!.Value)).WithMessage(OrderRules.MoneyDecimals);

        RuleFor(expense => expense.Description)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.ExpenseDescriptionMaxLength).WithMessage(ExpenseRules.DescriptionTooLong);

        RuleFor(expense => expense.PaidByUserId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.PaidByRequired);
    }

    private static void CheckDate(string? text, ValidationContext<IOrderExpenseFields> context)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            context.AddFailure(ExpenseRules.DateRequired);
            return;
        }

        if (!OrderDetailsFieldsValidator.TryParseDate(text, out var date))
        {
            context.AddFailure(OrderRules.DateInvalid);
            return;
        }

        if (!context.RootContextData.TryGetValue(TodayKey, out var today) || today is not DateOnly businessToday)
        {
            throw new InvalidOperationException($"The expense validator needs the business today as a DateOnly under '{TodayKey}'.");
        }

        var latest = ExpenseRules.Latest(businessToday);
        if (date > latest)
        {
            context.AddFailure(ExpenseRules.DateTooFar(latest));
        }
    }
}
