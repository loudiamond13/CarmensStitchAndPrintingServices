using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.ExpenseCategories;

/// <summary>
/// Use case: a Manager adds an expense category (CEXP-02, D-08, D-13). The form is checked against the field rules and, in the same
/// 400, against the other names: no category, retired ones included, may hold the same name in any letter case (OQ-10). The unique
/// index decides a race, and that loss is the same field error. Who added it and when come from the token and the clock (SEC-08).
/// One audit entry joins the save (D-27).
/// </summary>
public sealed class CreateExpenseCategoryHandler(
    IExpenseCategories categories,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IValidator<CreateExpenseCategoryRequest> validator)
{
    private const string CategoryTarget = "ExpenseCategory";

    /// <summary>Adds the category.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new category as the list shows it, or a 400 listing every field that failed.</returns>
    public async Task<Result<ExpenseCategoryListItem>> HandleAsync(CreateExpenseCategoryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (validation.Errors.All(static failure => failure.PropertyName != nameof(CreateExpenseCategoryRequest.Name))
            && await categories.NameTakenAsync(ExpenseCategory.Normalize(request.Name!), null, cancellationToken).ConfigureAwait(false))
        {
            validation.Errors.Add(NameTaken());
        }

        if (!validation.IsValid)
        {
            return Failed(validation);
        }

        var created = ExpenseCategory.Create(request.Name!, request.Tone!, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<ExpenseCategoryListItem>(created.Error);
        }

        var category = created.Value;
        try
        {
            await unitOfWork.InTransactionAsync(
                async token =>
                {
                    categories.Add(category);
                    audit.Record(
                        AuditActions.ExpenseCategoryAdded,
                        CategoryTarget,
                        AuditKey.Of(category.Id),
                        CategoryAuditDetail.Added(category.Name, category.Tone));
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return category.Id;
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (CategoryNameTakenException)
        {
            return Failed(new ValidationResult([NameTaken()]));
        }

        return Result.Success(new ExpenseCategoryListItem(
            category.Id,
            category.Name,
            category.Tone,
            ExpenseCategoryListItem.ActiveStatus,
            IsOthers: false,
            ExpenseCount: 0));
    }

    private static ValidationFailure NameTaken() => new(nameof(CreateExpenseCategoryRequest.Name), ExpenseCategoryRules.NameTaken);

    private static Result<ExpenseCategoryListItem> Failed(ValidationResult validation) =>
        Result.Failure<ExpenseCategoryListItem>(ValidationResults.ToError(validation, ExpenseCategoryErrors.ValidationCode, ExpenseCategoryErrors.ValidationMessage));
}
