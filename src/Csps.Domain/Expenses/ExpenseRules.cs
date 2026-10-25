using System.Globalization;

namespace Csps.Domain.Expenses;

/// <summary>
/// The limits and plain-English field messages of a company expense (D-19, D-20, D-21, OQ-10), shared by the domain, the
/// validators and the tests so every layer says the same words. Lengths are UTF-16 code units after trimming, the same
/// measure as a browser string length.
/// </summary>
public static class ExpenseRules
{
    /// <summary>The longest description.</summary>
    public const int DescriptionMaxLength = 200;

    /// <summary>The longest notes text (D-19).</summary>
    public const int NotesMaxLength = 1000;

    /// <summary>The largest amount (D-21). The database checks only that an amount is positive (D-33).</summary>
    public const decimal AmountMax = 1_000_000.00m;

    /// <summary>The most decimal places an amount may have.</summary>
    public const int AmountScale = 2;

    /// <summary>How many days after the business today an expense may be dated (D-20).</summary>
    public const int DaysAhead = 30;

    /// <summary>The date format of the wire and the audit log.</summary>
    public const string DateFormat = "yyyy-MM-dd";

    /// <summary>The field name of the date.</summary>
    public const string DateField = "date";

    /// <summary>The field name of the category.</summary>
    public const string CategoryField = "categoryId";

    /// <summary>The field name of the description.</summary>
    public const string DescriptionField = "description";

    /// <summary>The field name of the amount.</summary>
    public const string AmountField = "amount";

    /// <summary>The field name of the payer.</summary>
    public const string PaidByField = "paidByUserId";

    /// <summary>The field name of the notes.</summary>
    public const string NotesField = "notes";

    /// <summary>The machine code of a create or edit that breaks field rules.</summary>
    public const string InvalidCode = "company-expenses.invalid-request";

    /// <summary>The text above the field errors.</summary>
    public const string InvalidMessage = "Check the highlighted fields.";

    /// <summary>The message for a missing date.</summary>
    public const string DateRequired = "Enter the date.";

    /// <summary>The message for a date that is not a real calendar day.</summary>
    public const string DateInvalid = "Enter a real date.";

    /// <summary>The message for a missing or unknown category.</summary>
    public const string CategoryRequired = "Choose a category.";

    /// <summary>The message for a retired category chosen on a new expense (D-11).</summary>
    public const string CategoryRetired = "This category was retired. Choose another one.";

    /// <summary>The message for a missing description.</summary>
    public const string DescriptionRequired = "Add a short description so others know what this was for.";

    /// <summary>The message for a description over the limit.</summary>
    public const string DescriptionTooLong = "Keep the description to 200 characters or fewer.";

    /// <summary>The message for a missing amount or one that is not more than zero.</summary>
    public const string AmountTooSmall = "Enter an amount greater than ₱0.00.";

    /// <summary>The message for an amount over the cap.</summary>
    public const string AmountTooLarge = "Enter an amount of ₱1,000,000.00 or less.";

    /// <summary>The message for an amount with more than two decimal places.</summary>
    public const string AmountDecimals = "Use at most 2 decimal places.";

    /// <summary>The message for a missing payer.</summary>
    public const string PaidByRequired = "Choose who paid.";

    /// <summary>The message for a payer who cannot be chosen (D-17, D-32).</summary>
    public const string PaidByInactive = "This person can't be chosen because their account isn't active. Choose someone else.";

    /// <summary>The message for notes over the limit.</summary>
    public const string NotesTooLong = "Keep notes to 1,000 characters or fewer.";

    /// <summary>Gets the latest day an expense may be dated, given the business today.</summary>
    /// <param name="today">The business today.</param>
    /// <returns>The day thirty days after <paramref name="today"/>.</returns>
    public static DateOnly Latest(DateOnly today) => today.AddDays(DaysAhead);

    /// <summary>Builds the message for a date that is too far ahead.</summary>
    /// <param name="latest">The latest allowed day.</param>
    /// <returns>The message, naming that day as <c>MMM d, yyyy</c>.</returns>
    public static string DateTooFar(DateOnly latest) =>
        string.Create(CultureInfo.InvariantCulture, $"Choose a date up to {DaysAhead} days from today, {latest:MMM d, yyyy} at the latest.");

    /// <summary>Tells whether an amount has no more than <see cref="AmountScale"/> decimal places.</summary>
    /// <param name="amount">The amount.</param>
    /// <returns>True when rounding to two places changes nothing.</returns>
    public static bool HasValidScale(decimal amount) => decimal.Round(amount, AmountScale) == amount;
}
