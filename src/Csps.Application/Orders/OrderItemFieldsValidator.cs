using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// The one set of item rules for the New Order form and the item routes (OR-3, ORD-13, D-18, D-30): a product type, a description
/// of 1 to 200 characters, a size or variant of up to 100, a quantity from 1 to 10,000, and a unit price from 0.00 to
/// 1,000,000.00 with at most two decimal places. Whether the product type exists and is not retired needs the database and runs
/// in the handlers.
/// </summary>
public sealed class OrderItemFieldsValidator : AbstractValidator<IOrderItemFields>
{
    /// <summary>Creates the validator.</summary>
    public OrderItemFieldsValidator()
    {
        RuleFor(item => item.ProductTypeId)
            .Must(static id => id is { } value && value != Guid.Empty).WithMessage(OrderRules.ProductTypeRequired);

        RuleFor(item => item.Description)
            .Cascade(CascadeMode.Stop)
            .Must(static text => !string.IsNullOrWhiteSpace(text)).WithMessage(OrderRules.DescriptionRequired)
            .Must(static text => text!.Trim().Length <= OrderRules.ItemDescriptionMaxLength).WithMessage(OrderRules.DescriptionTooLong);

        RuleFor(item => item.SizeVariant)
            .Must(static text => text is null || text.Trim().Length <= OrderRules.SizeVariantMaxLength).WithMessage(OrderRules.SizeVariantTooLong);

        RuleFor(item => item.Quantity)
            .Must(static quantity => quantity is >= OrderRules.QuantityMin and <= OrderRules.QuantityMax).WithMessage(OrderRules.QuantityOutOfRange);

        RuleFor(item => item.UnitPrice)
            .Cascade(CascadeMode.Stop)
            .Must(static price => price is not null).WithMessage(OrderRules.UnitPriceRequired)
            .Must(static price => price >= 0m && price <= OrderRules.UnitPriceMax).WithMessage(OrderRules.UnitPriceOutOfRange)
            .PrecisionScale(18, OrderRules.MoneyScale, true).WithMessage(OrderRules.MoneyDecimals);
    }
}
