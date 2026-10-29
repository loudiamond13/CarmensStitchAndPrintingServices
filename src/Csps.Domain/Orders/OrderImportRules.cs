namespace Csps.Domain.Orders;

/// <summary>
/// The named leniencies of a legacy import (ORD-21). <see cref="Order.Import"/> always keeps the structural rules (a number, a known
/// status and discount kind, no negative quantity or price, money to two decimals, payments, refunds and expenses above zero, text
/// that fits its column). Each property here relaxes one other rule of the normal create path, so an owner ruling on a legacy
/// oddity is a change of one value, never a schema change. <see cref="Default"/> relaxes all of them; <see cref="Strict"/> relaxes none.
/// </summary>
public sealed record OrderImportRules
{
    /// <summary>Gets the rules the migration uses: every relaxation on.</summary>
    public static OrderImportRules Default { get; } = new()
    {
        KeepLegacyNumber = true,
        DueDateOptional = true,
        ContactNumberOptional = true,
        AllowOverpaid = true,
        AllowCompletedWithBalance = true,
        AllowDiscountAboveSubtotal = true,
        IgnoreAmountCaps = true,
        AllowFutureDates = true,
        AllowRetiredListEntries = true,
        AllowLegacyHolder = true,
        AllowInactivePeople = true,
        AllowAnyStatusHistory = true,
        IgnoreChildCaps = true,
        AllowNoItems = true,
    };

    /// <summary>Gets the rules of the normal create path: no relaxation, only the structural checks and the number format.</summary>
    public static OrderImportRules Strict { get; } = new();

    /// <summary>Gets a value indicating whether the number is stored as given, in any format up to 32 characters, not only <c>ORD-{YYYY}-{NNNN}</c>.</summary>
    public bool KeepLegacyNumber { get; init; }

    /// <summary>Gets a value indicating whether an order may have no due date (D-22).</summary>
    public bool DueDateOptional { get; init; }

    /// <summary>Gets a value indicating whether an order may have no contact number.</summary>
    public bool ContactNumberOptional { get; init; }

    /// <summary>Gets a value indicating whether payments may add up to more than the total, which leaves a customer credit (D-14).</summary>
    public bool AllowOverpaid { get; init; }

    /// <summary>Gets a value indicating whether a Completed order may still have a balance or a credit (D-14: D-03 is not applied).</summary>
    public bool AllowCompletedWithBalance { get; init; }

    /// <summary>Gets a value indicating whether the discounts may add up to more than the subtotal (D-40).</summary>
    public bool AllowDiscountAboveSubtotal { get; init; }

    /// <summary>Gets a value indicating whether the quantity, price, discount, payment, refund and expense limits are skipped (06 D-33).</summary>
    public bool IgnoreAmountCaps { get; init; }

    /// <summary>Gets a value indicating whether payment, refund and expense dates may be in the future.</summary>
    public bool AllowFutureDates { get; init; }

    /// <summary>Gets a value indicating whether a retired product type, payment method or expense category may be named. The handler reads this.</summary>
    public bool AllowRetiredListEntries { get; init; }

    /// <summary>Gets a value indicating whether the Legacy / unassigned holder may be named as a person (D-32). The handler reads this.</summary>
    public bool AllowLegacyHolder { get; init; }

    /// <summary>Gets a value indicating whether a person who can no longer be chosen (deactivated, locked or deleted) may be named. The handler reads this.</summary>
    public bool AllowInactivePeople { get; init; }

    /// <summary>Gets a value indicating whether the status history may hold moves the normal status rules refuse.</summary>
    public bool AllowAnyStatusHistory { get; init; }

    /// <summary>Gets a value indicating whether the limits on how many items, discounts, payments, refunds and expenses an order holds are skipped.</summary>
    public bool IgnoreChildCaps { get; init; }

    /// <summary>Gets a value indicating whether an order may have no items.</summary>
    public bool AllowNoItems { get; init; }
}
