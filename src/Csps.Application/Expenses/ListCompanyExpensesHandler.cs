using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: staff of either role list expenses (CEXP-01, D-25). The query is checked first and the port is never called for a bad
/// one. With neither date the window runs from 30 days before to 30 days after the business today (D-23), so the browser never
/// reads the device clock. Each row says whether the caller may edit it (D-26).
/// </summary>
public sealed class ListCompanyExpensesHandler(
    ICompanyExpenseReader reader,
    IStaffDirectory staff,
    IBusinessCalendar calendar,
    IRequestContext requestContext,
    IValidator<ListCompanyExpensesRequest> validator)
{
    /// <summary>The days either side of the business today in the default window.</summary>
    public const int DefaultWindowDays = 30;

    /// <summary>Lists one page of expenses.</summary>
    /// <param name="request">The filters and page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, a 400 naming the bad fields, or a 401 when the token names no usable account.</returns>
    public async Task<Result<CompanyExpenseListResponse>> HandleAsync(ListCompanyExpensesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<CompanyExpenseListResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<CompanyExpenseListResponse>(ValidationResults.ToError(validation, ExpenseErrors.ValidationCode, ExpenseErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        DateOnly from;
        DateOnly to;
        if (string.IsNullOrWhiteSpace(request.From))
        {
            from = clock.Today.AddDays(-DefaultWindowDays);
            to = clock.Today.AddDays(DefaultWindowDays);
        }
        else
        {
            _ = CreateCompanyExpenseRequestValidator.TryParseDate(request.From, out from);
            _ = CreateCompanyExpenseRequestValidator.TryParseDate(request.To, out to);
        }

        _ = ListCompanyExpensesRequestValidator.TryParseCategory(request.Category, out var category);
        var search = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        var page = await reader
            .ListAsync(new CompanyExpenseListQuery(from, to, category == Guid.Empty ? null : category, search, request.Page, request.PageSize), cancellationToken)
            .ConfigureAwait(false);

        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        var callerIsManager = caller?.IsManager == true;
        IReadOnlyList<CompanyExpenseListItem> items =
        [
            .. page.Items.Select(row => new CompanyExpenseListItem(
                row.Id,
                row.Date,
                row.Category,
                row.Description,
                row.Amount,
                row.PaidBy,
                row.RecordedBy,
                ExpenseAccess.CanEdit(row.CreatedById, row.PaidByUserId, callerId, callerIsManager))),
        ];
        return Result.Success(new CompanyExpenseListResponse(items, page.Total, request.Page, request.PageSize, page.PeriodTotal, from, to, clock.Today));
    }
}
