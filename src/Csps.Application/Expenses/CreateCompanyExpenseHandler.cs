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
/// Use case: a staff member records a company expense (CEXP-02). The form is checked against the field rules and, in the same
/// 400, against the database: the category must exist and be active (D-11) and the payer must pass the payer rule (D-17, D-32).
/// Who recorded it and when come from the token and the clock, never from the request (SEC-08). One audit entry joins the
/// save, holding the date, category, amount and payer but never the description or notes (D-27).
/// </summary>
public sealed class CreateCompanyExpenseHandler(
    ICompanyExpenses expenses,
    ICompanyExpenseReader reader,
    IExpenseCategories categories,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateCompanyExpenseRequest> validator)
{
    private const string ExpenseTarget = "CompanyExpense";

    /// <summary>Records the expense.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new expense, a 400 listing every field that failed, or a 401 when the token names no usable account.</returns>
    public async Task<Result<CompanyExpenseDetailResponse>> HandleAsync(CreateCompanyExpenseRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<CreateCompanyExpenseRequest>(request);
        context.RootContextData[CreateCompanyExpenseRequestValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        await CheckReferencesAsync(request, validation, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        _ = CreateCompanyExpenseRequestValidator.TryParseDate(request.Date, out var date);
        var created = CompanyExpense.Create(
            date,
            request.CategoryId!.Value,
            request.Description!,
            request.Amount!.Value,
            request.PaidByUserId!.Value,
            request.Notes,
            clock.Today,
            clock.UtcNow);
        if (created.IsFailure)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(created.Error);
        }

        var expense = created.Value;
        await unitOfWork.InTransactionAsync(
            async token =>
            {
                expenses.Add(expense);
                audit.Record(
                    AuditActions.CompanyExpenseAdded,
                    ExpenseTarget,
                    AuditKey.Of(expense.Id),
                    ExpenseAuditDetail.Snapshot(expense.ExpenseDate, expense.CategoryId, expense.Amount, expense.PaidByUserId));
                await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                return expense.Id;
            },
            cancellationToken).ConfigureAwait(false);

        var view = await reader.GetDetailAsync(expense.Id, cancellationToken).ConfigureAwait(false);
        if (view is null)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(ExpenseErrors.NotFound);
        }

        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        return Result.Success(CompanyExpenseDetailResponse.From(view, callerId, caller?.IsManager == true));
    }

    // The category and the payer are looked up only when their ids parsed, so one 400 lists every field that failed.
    private async Task CheckReferencesAsync(CreateCompanyExpenseRequest request, ValidationResult validation, CancellationToken cancellationToken)
    {
        if (request.CategoryId is { } categoryId && categoryId != Guid.Empty)
        {
            var category = await categories.GetStateAsync(categoryId, cancellationToken).ConfigureAwait(false);
            if (category is null)
            {
                validation.Errors.Add(new ValidationFailure(nameof(CreateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRequired));
            }
            else if (category.Retired)
            {
                validation.Errors.Add(new ValidationFailure(nameof(CreateCompanyExpenseRequest.CategoryId), ExpenseRules.CategoryRetired));
            }
        }

        if (request.PaidByUserId is { } payerId && payerId != Guid.Empty)
        {
            var payer = await staff.GetStaffStateAsync(payerId, cancellationToken).ConfigureAwait(false);
            if (payer is not { CanPay: true })
            {
                validation.Errors.Add(new ValidationFailure(nameof(CreateCompanyExpenseRequest.PaidByUserId), ExpenseRules.PaidByInactive));
            }
        }
    }
}
