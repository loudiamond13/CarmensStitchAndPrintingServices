#if CSPS_TESTING
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary>One expense to seed for an E2E spec.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="CategoryId">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount.</param>
/// <param name="PaidByUserId">The payer.</param>
/// <param name="RecordedByUserId">The recorder; null reads as System.</param>
/// <param name="Notes">Optional notes.</param>
/// <param name="Deleted">True to soft-delete the expense at once.</param>
/// <param name="Today">The business today, for the date rule.</param>
public sealed record TestingExpenseInput(
    DateOnly Date,
    Guid CategoryId,
    string Description,
    decimal Amount,
    Guid PaidByUserId,
    Guid? RecordedByUserId,
    string? Notes,
    bool Deleted,
    DateOnly Today);

/// <summary>
/// Inserts an expense with a chosen recorder and delete state for the Testing-only seeding endpoint (QUAL-05). Debug builds only.
/// The record-stamp interceptor overwrites the recorder on every added row (with nobody, for the anonymous testing caller), so the row
/// is saved first and the recorder and the delete marker are then written with one <c>ExecuteUpdateAsync</c>, which skips the interceptors.
/// </summary>
/// <param name="context">The database context.</param>
/// <param name="time">The clock.</param>
public sealed class TestingExpenseSeeder(CspsDbContext context, TimeProvider time)
{
    /// <summary>Saves the expense and stamps its recorder.</summary>
    /// <param name="input">The expense to seed.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new expense id, or a validation error naming the field that failed.</returns>
    public async Task<Result<Guid>> CreateAsync(TestingExpenseInput input, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(input);

        if (!await context.Users.AsNoTracking().AnyAsync(user => user.Id == input.PaidByUserId, cancellationToken).ConfigureAwait(false))
        {
            return Rejected(ExpenseRules.PaidByField, "No person has this id.");
        }

        if (input.RecordedByUserId is { } recorderId && !await context.Users.AsNoTracking().AnyAsync(user => user.Id == recorderId, cancellationToken).ConfigureAwait(false))
        {
            return Rejected("recordedByUserId", "No person has this id.");
        }

        if (!await context.ExpenseCategories.AsNoTracking().AnyAsync(category => category.Id == input.CategoryId, cancellationToken).ConfigureAwait(false))
        {
            return Rejected(ExpenseRules.CategoryField, ExpenseRules.CategoryRequired);
        }

        var now = time.GetUtcNow();
        var created = CompanyExpense.Create(input.Date, input.CategoryId, input.Description, input.Amount, input.PaidByUserId, input.Notes, input.Today, now);
        if (created.IsFailure)
        {
            return Result.Failure<Guid>(created.Error);
        }

        var expense = created.Value;
        context.CompanyExpenses.Add(expense);
        await context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var recorder = input.RecordedByUserId;
        var rows = input.Deleted
            ? await context.CompanyExpenses
                .Where(row => row.Id == expense.Id)
                .ExecuteUpdateAsync(
                    set => set
                        .SetProperty(row => row.CreatedById, recorder)
                        .SetProperty(row => row.DeletedAtUtc, now)
                        .SetProperty(row => row.DeletedById, recorder),
                    cancellationToken)
                .ConfigureAwait(false)
            : await context.CompanyExpenses
                .Where(row => row.Id == expense.Id)
                .ExecuteUpdateAsync(set => set.SetProperty(row => row.CreatedById, recorder), cancellationToken)
                .ConfigureAwait(false);
        return rows == 1
            ? Result.Success(expense.Id)
            : throw new InvalidOperationException("The seeded expense was not found to stamp.");
    }

    private static Result<Guid> Rejected(string field, string message) =>
        Result.Failure<Guid>(Error.Validation(
            ExpenseRules.InvalidCode,
            ExpenseRules.InvalidMessage,
            new Dictionary<string, string[]> { [field] = [message] }));
}
#endif
