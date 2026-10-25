using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: a staff member edits a company expense with the version the form was opened with (CEXP-02, SEC-07). The steps run in
/// this order and stop at the first failure: the form is checked (400), the expense is found (404), the caller may edit it (403,
/// D-26), the version is the stored one (409), then the changed category and payer are checked against the database (400). A form
/// save never retries on a conflict: the person reloads and decides. A form with no change saves nothing, writes no audit entry and
/// keeps the version. A change writes <c>company-expense.changed</c> (old and new amount, date and category, field names only) and,
/// when the payer moved, a separate <c>company-expense.payer-changed</c>, both in the same save (D-27).
/// Who changed it and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class UpdateCompanyExpenseHandler(
    ICompanyExpenses expenses,
    ICompanyExpenseReader reader,
    IExpenseCategories categories,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateCompanyExpenseRequest> validator)
{
    private const string ExpenseTarget = "CompanyExpense";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The expense to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The expense as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 403 when an Admin
    /// neither recorded nor paid it, a 404 when it does not exist or was deleted, or a 409 for a stale version or a lost race.
    /// </returns>
    public async Task<Result<CompanyExpenseDetailResponse>> HandleAsync(Guid id, UpdateCompanyExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<UpdateCompanyExpenseRequest>(request);
        context.RootContextData[UpdateCompanyExpenseRequestValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = ExpenseFieldsValidator.TryParseDate(request.Date, out var date);
        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        var callerIsManager = caller?.IsManager == true;
        var form = new EditForm(date, request.CategoryId!.Value, request.Description!, request.Amount!.Value, request.PaidByUserId!.Value, request.Notes);

        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                token => AttemptAsync(id, callerId, callerIsManager, form, version, clock.Today, token),
                cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<CompanyExpenseDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(EditErrors.Stale);
        }
        catch (CategoryDeletedException)
        {
            // A Manager deleted the new category between the check and the save: answer it like an unknown category.
            var gone = new ValidationResult([new ValidationFailure(nameof(UpdateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRequired)]);
            return Result.Failure<CompanyExpenseDetailResponse>(ValidationResults.ToError(gone, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<CompanyExpenseDetailResponse>(ExpenseErrors.NotFound)
            : Result.Success(CompanyExpenseDetailResponse.From(view, callerId, callerIsManager));
    }

    private async Task<Result<bool>> AttemptAsync(
        Guid id, Guid callerId, bool callerIsManager, EditForm form, byte[] version, DateOnly today, CancellationToken cancellationToken)
    {
        var expense = await expenses.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (expense is null)
        {
            return Result.Failure<bool>(ExpenseErrors.NotFound);
        }

        if (!ExpenseAccess.CanEdit(expense.CreatedById, expense.PaidByUserId, callerId, callerIsManager))
        {
            return Result.Failure<bool>(ExpenseErrors.NotYours);
        }

        if (!expense.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var references = await CheckChangedReferencesAsync(expense, form, cancellationToken).ConfigureAwait(false);
        if (!references.IsValid)
        {
            return Result.Failure<bool>(ValidationResults.ToError(references, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        var changes = expense.Update(form.Date, form.CategoryId, form.Description, form.Amount, form.PaidByUserId, form.Notes, today);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        if (!changes.Value.HasAny)
        {
            return Result.Success(false);
        }

        // A payer change is its own entry and is never merged into the field change (D-27).
        var key = AuditKey.Of(expense.Id);
        if (changes.Value.HasFieldChange)
        {
            audit.Record(AuditActions.CompanyExpenseChanged, ExpenseTarget, key, ExpenseAuditDetail.Changes(changes.Value, expense.PaidByUserId));
        }

        if (changes.Value.Payer is { } payer)
        {
            audit.Record(AuditActions.CompanyExpensePayerChanged, ExpenseTarget, key, ExpenseAuditDetail.PayerChange(payer.From, payer.To));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    // Only a category or payer that the form changes is looked up: a saved retired category, or a saved payer who has since been
    // deactivated, may stay on the expense (D-11, OQ-7).
    private async Task<ValidationResult> CheckChangedReferencesAsync(CompanyExpense expense, EditForm form, CancellationToken cancellationToken)
    {
        var result = new ValidationResult();
        if (form.CategoryId != expense.CategoryId)
        {
            var category = await categories.GetStateAsync(form.CategoryId, cancellationToken).ConfigureAwait(false);
            if (category is null)
            {
                result.Errors.Add(new ValidationFailure(nameof(UpdateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRequired));
            }
            else if (category.Retired)
            {
                result.Errors.Add(new ValidationFailure(nameof(UpdateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRetired));
            }
        }

        if (form.PaidByUserId != expense.PaidByUserId)
        {
            var payer = await staff.GetStaffStateAsync(form.PaidByUserId, cancellationToken).ConfigureAwait(false);
            if (payer is not { CanPay: true })
            {
                result.Errors.Add(new ValidationFailure(nameof(UpdateCompanyExpenseRequest.PaidByUserId), ExpenseRules.PaidByInactive));
            }
        }

        return result;
    }

    private sealed record EditForm(DateOnly Date, Guid CategoryId, string Description, decimal Amount, Guid PaidByUserId, string? Notes);
}
