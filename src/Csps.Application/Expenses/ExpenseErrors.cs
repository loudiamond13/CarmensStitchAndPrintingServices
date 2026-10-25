using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Application.Expenses;

/// <summary>The error values the company expense use cases return.</summary>
public static class ExpenseErrors
{
    /// <summary>The machine code of a form that breaks field rules.</summary>
    public const string ValidationCode = ExpenseRules.InvalidCode;

    /// <summary>The text above the field errors.</summary>
    public const string ValidationMessage = ExpenseRules.InvalidMessage;

    /// <summary>The code of an expense that does not exist or was soft-deleted (D-01).</summary>
    public const string NotFoundCode = "company-expenses.not-found";

    /// <summary>The plain-English text for an expense that does not exist or was soft-deleted.</summary>
    public const string NotFoundMessage = "This expense was deleted.";

    /// <summary>Gets the answer for an expense that does not exist or was soft-deleted: a 404 with the same words for both.</summary>
    public static Error NotFound { get; } = Error.NotFound(NotFoundCode, NotFoundMessage);
}
