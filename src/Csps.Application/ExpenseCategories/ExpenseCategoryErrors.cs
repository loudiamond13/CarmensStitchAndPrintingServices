using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Application.ExpenseCategories;

/// <summary>The error values the category use cases return.</summary>
public static class ExpenseCategoryErrors
{
    /// <summary>The machine code of a form that breaks field rules.</summary>
    public const string ValidationCode = ExpenseCategory.InvalidCode;

    /// <summary>The text above the field errors.</summary>
    public const string ValidationMessage = ExpenseCategory.InvalidMessage;

    /// <summary>The code of a category that does not exist.</summary>
    public const string NotFoundCode = "expense-categories.not-found";

    /// <summary>The plain-English text for a category that does not exist.</summary>
    public const string NotFoundMessage = "This category was deleted.";

    /// <summary>The code of a delete refused because an expense uses the category (D-10, D-30).</summary>
    public const string InUseCode = "expense-categories.in-use";

    /// <summary>The plain-English text for a delete refused because an expense uses the category.</summary>
    public const string InUseMessage = "This category is used by an expense, so it can't be deleted. Retire it instead.";

    /// <summary>Gets the 404 for a category that does not exist.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);

    /// <summary>Gets the 422 for retiring or deleting Others (OQ-6).</summary>
    public static Error Protected { get; } = ExpenseCategory.Protected();

    /// <summary>Gets the 422 for deleting a category an expense uses (D-10, D-30).</summary>
    public static Error InUse { get; } = Error.BusinessRule(InUseCode, InUseMessage);
}
