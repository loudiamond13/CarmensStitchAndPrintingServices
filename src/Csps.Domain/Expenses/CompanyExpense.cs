using Csps.Domain.Common;

namespace Csps.Domain.Expenses;

/// <summary>
/// One company expense (CEXP-02): something the shop paid for, who paid it and which category it belongs to. The amount is
/// money in whole centavos (<c>decimal(18,2)</c>), never a float. The row is soft-deleted rather than removed (D-01), and
/// the attribution members are set only by the database layer from the token and the clock (SEC-08).
/// </summary>
public sealed class CompanyExpense : IAttributedRecord
{
    // Used by EF Core (constructor binding) and by Create.
    private CompanyExpense(Guid id, DateOnly expenseDate, Guid categoryId, string description, decimal amount, Guid paidByUserId, string? notes)
    {
        Id = id;
        ExpenseDate = expenseDate;
        CategoryId = categoryId;
        Description = description;
        Amount = amount;
        PaidByUserId = paidByUserId;
        Notes = notes;
        RowVersion = [];
    }

    /// <summary>Primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>The day the money was spent, in the business calendar.</summary>
    public DateOnly ExpenseDate { get; private set; }

    /// <summary>The category (D-08).</summary>
    public Guid CategoryId { get; private set; }

    /// <summary>What the expense was for, trimmed.</summary>
    public string Description { get; private set; }

    /// <summary>The amount in pesos, more than zero and at most <see cref="ExpenseRules.AmountMax"/>.</summary>
    public decimal Amount { get; private set; }

    /// <summary>The staff member whose money paid for it (D-17).</summary>
    public Guid PaidByUserId { get; private set; }

    /// <summary>Optional notes, trimmed; null when empty (D-19).</summary>
    public string? Notes { get; private set; }

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>When the expense was soft-deleted; null while it counts (D-01).</summary>
    public DateTimeOffset? DeletedAtUtc { get; private set; }

    /// <summary>Who soft-deleted it; null while it counts.</summary>
    public Guid? DeletedById { get; private set; }

    /// <summary>The row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>True once the expense is soft-deleted.</summary>
    public bool IsDeleted => DeletedAtUtc is not null;

    /// <summary>Records a new expense, checking every field rule again so no caller can skip one.</summary>
    /// <param name="date">The day the money was spent; any past day, up to thirty days after <paramref name="today"/>.</param>
    /// <param name="categoryId">The category.</param>
    /// <param name="description">What it was for; required after trimming, at most 200 characters.</param>
    /// <param name="amount">The amount; more than 0.00, at most 1,000,000.00, at most two decimal places.</param>
    /// <param name="paidByUserId">The payer.</param>
    /// <param name="notes">Optional notes; empty means none, at most 1,000 characters.</param>
    /// <param name="today">The business today.</param>
    /// <param name="now">The current instant, which makes the key.</param>
    /// <returns>The new, unsaved expense, or a validation error naming the first broken field.</returns>
    public static Result<CompanyExpense> Create(
        DateOnly date,
        Guid categoryId,
        string description,
        decimal amount,
        Guid paidByUserId,
        string? notes,
        DateOnly today,
        DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(description);

        if (date > ExpenseRules.Latest(today))
        {
            return Reject(ExpenseRules.DateField, ExpenseRules.DateTooFar(ExpenseRules.Latest(today)));
        }

        if (categoryId == Guid.Empty)
        {
            return Reject(ExpenseRules.CategoryField, ExpenseRules.CategoryRequired);
        }

        var trimmedDescription = description.Trim();
        if (trimmedDescription.Length == 0)
        {
            return Reject(ExpenseRules.DescriptionField, ExpenseRules.DescriptionRequired);
        }

        if (trimmedDescription.Length > ExpenseRules.DescriptionMaxLength)
        {
            return Reject(ExpenseRules.DescriptionField, ExpenseRules.DescriptionTooLong);
        }

        if (amount <= 0m)
        {
            return Reject(ExpenseRules.AmountField, ExpenseRules.AmountTooSmall);
        }

        if (amount > ExpenseRules.AmountMax)
        {
            return Reject(ExpenseRules.AmountField, ExpenseRules.AmountTooLarge);
        }

        if (!ExpenseRules.HasValidScale(amount))
        {
            return Reject(ExpenseRules.AmountField, ExpenseRules.AmountDecimals);
        }

        if (paidByUserId == Guid.Empty)
        {
            return Reject(ExpenseRules.PaidByField, ExpenseRules.PaidByRequired);
        }

        var trimmedNotes = notes?.Trim();
        if (trimmedNotes is { Length: > ExpenseRules.NotesMaxLength })
        {
            return Reject(ExpenseRules.NotesField, ExpenseRules.NotesTooLong);
        }

        return Result.Success(new CompanyExpense(
            Guid.CreateVersion7(now),
            date,
            categoryId,
            trimmedDescription,
            amount,
            paidByUserId,
            string.IsNullOrEmpty(trimmedNotes) ? null : trimmedNotes));
    }

    private static Result<CompanyExpense> Reject(string field, string message) =>
        Result.Failure<CompanyExpense>(Error.Validation(
            ExpenseRules.InvalidCode,
            ExpenseRules.InvalidMessage,
            new Dictionary<string, string[]> { [field] = [message] }));
}
