namespace Csps.Application.ExpenseCategories;

/// <summary>The fields the Add Category and Edit Category forms share, so one validator checks both (OR-3).</summary>
public interface IExpenseCategoryFields
{
    /// <summary>Gets the name the form sent.</summary>
    string? Name { get; }

    /// <summary>Gets the tone the form sent.</summary>
    string? Tone { get; }
}
