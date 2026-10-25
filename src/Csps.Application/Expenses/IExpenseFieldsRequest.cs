using System.Diagnostics.CodeAnalysis;

namespace Csps.Application.Expenses;

/// <summary>The fields the Add Expense and Edit Expense forms share, so one validator checks both (D-19, D-20, D-21).</summary>
[SuppressMessage("Naming", "CA1716:Identifiers should not match keywords", Justification = "C#-only solution; 'Date' is the wire name of the form field and is only a keyword in VB.")]
public interface IExpenseFieldsRequest
{
    /// <summary>Gets the day the money was spent, <c>yyyy-MM-dd</c>.</summary>
    string? Date { get; }

    /// <summary>Gets the category.</summary>
    Guid? CategoryId { get; }

    /// <summary>Gets what it was for.</summary>
    string? Description { get; }

    /// <summary>Gets the amount in pesos.</summary>
    decimal? Amount { get; }

    /// <summary>Gets the staff member who paid.</summary>
    Guid? PaidByUserId { get; }

    /// <summary>Gets the optional notes.</summary>
    string? Notes { get; }
}
