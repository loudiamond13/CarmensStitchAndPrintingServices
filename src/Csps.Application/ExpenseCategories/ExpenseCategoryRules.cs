using Csps.Domain.Expenses;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// The field names and plain-English messages of the category forms (D-13, OQ-6, OQ-10). The rules that the domain checks again
/// are the domain's own words; the two that need the database or the Others id are written here.
/// </summary>
public static class ExpenseCategoryRules
{
    /// <summary>The field name of the category name.</summary>
    public const string NameField = ExpenseCategory.NameField;

    /// <summary>The field name of the tone.</summary>
    public const string ToneField = ExpenseCategory.ToneField;

    /// <summary>The message for a missing name.</summary>
    public const string NameRequired = ExpenseCategory.NameRequiredMessage;

    /// <summary>The message for a name over 40 characters.</summary>
    public const string NameTooLong = ExpenseCategory.NameTooLongMessage;

    /// <summary>The message for a tone outside the six.</summary>
    public const string ToneInvalid = ExpenseCategory.ToneInvalidMessage;

    /// <summary>The message for a name that another category, retired ones included, already holds (OQ-10).</summary>
    public const string NameTaken = "Another category already has this name.";

    /// <summary>The message for renaming Others (OQ-6).</summary>
    public const string OthersNameLocked = "The Others name can't change.";
}
