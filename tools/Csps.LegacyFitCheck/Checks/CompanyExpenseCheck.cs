using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.LegacyFitCheck.Findings;
using FluentValidation;

namespace Csps.LegacyFitCheck.Checks;

/// <summary>
/// Judges a legacy company expense by the Phase 6 rules staff meet when they add an expense (D-12, D-16): the field validator with
/// the business today, then the category and payer lookups, in the order and words of the add-expense handler. It reads only. It
/// never calls that handler, so nothing is saved and nothing is audited.
/// </summary>
internal static class CompanyExpenseCheck
{
    public static async Task<IReadOnlyList<Finding>> CheckAsync(
        string legacyKey,
        CreateCompanyExpenseRequest request,
        DateOnly today,
        IExpenseCategories categories,
        IStaffDirectory staff,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(legacyKey);
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(categories);
        ArgumentNullException.ThrowIfNull(staff);

        var context = new ValidationContext<CreateCompanyExpenseRequest>(request);
        context.RootContextData[CreateCompanyExpenseRequestValidator.TodayKey] = today;
        var validation = await new CreateCompanyExpenseRequestValidator().ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        var failures = validation.Errors.Select(static error => (Field: error.PropertyName, Message: error.ErrorMessage)).ToList();

        // The category and the payer are looked up only when their ids parsed, as the add-expense handler does.
        if (request.CategoryId is { } categoryId && categoryId != Guid.Empty)
        {
            var category = await categories.GetStateAsync(categoryId, cancellationToken).ConfigureAwait(false);
            if (category is null)
            {
                failures.Add((nameof(CreateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRequired));
            }
            else if (category.Retired)
            {
                failures.Add((nameof(CreateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRetired));
            }
        }

        if (request.PaidByUserId is { } payerId && payerId != Guid.Empty)
        {
            var payer = await staff.GetStaffStateAsync(payerId, cancellationToken).ConfigureAwait(false);
            if (payer is not { CanPay: true })
            {
                failures.Add((nameof(CreateCompanyExpenseRequest.PaidByUserId), ExpenseRules.PaidByInactive));
            }
        }

        return [.. failures.Select(failure => new Finding(
            RecordKind.CompanyExpense,
            legacyKey,
            FindingType.ExpenseRule,
            $"{failure.Field}: {failure.Message}",
            failure.Field,
            failure.Message,
            null,
            null))];
    }
}
