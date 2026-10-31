namespace Csps.Application.Orders;

/// <summary>The discount fields the New Order form and the discount routes share, so one validator checks them all (D-15, ORD-05).</summary>
public interface IOrderDiscountFields
{
    /// <summary>Gets the kind key: <c>fixed</c> or <c>percentage</c>.</summary>
    string? Kind { get; }

    /// <summary>Gets the peso amount (fixed) or the percent (percentage).</summary>
    decimal? Value { get; }

    /// <summary>Gets why the discount is given.</summary>
    string? Reason { get; }
}
