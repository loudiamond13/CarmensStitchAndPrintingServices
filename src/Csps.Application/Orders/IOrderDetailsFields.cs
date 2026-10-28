namespace Csps.Application.Orders;

/// <summary>The customer and date fields the New Order and Edit Order forms share, so one validator checks both (D-21).</summary>
public interface IOrderDetailsFields
{
    /// <summary>Gets the customer's name.</summary>
    string? CustomerName { get; }

    /// <summary>Gets the team or club name.</summary>
    string? TeamName { get; }

    /// <summary>Gets the contact number.</summary>
    string? ContactNumber { get; }

    /// <summary>Gets the email address.</summary>
    string? Email { get; }

    /// <summary>Gets the address.</summary>
    string? Address { get; }

    /// <summary>Gets the day the order was taken, <c>yyyy-MM-dd</c>.</summary>
    string? OrderDate { get; }

    /// <summary>Gets the day it is due, <c>yyyy-MM-dd</c>.</summary>
    string? DueDate { get; }

    /// <summary>Gets the free notes.</summary>
    string? Notes { get; }
}
