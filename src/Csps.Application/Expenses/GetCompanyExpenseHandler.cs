using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Expenses;

/// <summary>Use case: staff of either role read one expense (CEXP-02, D-25). A soft-deleted or unknown expense is the same 404 (D-01).</summary>
public sealed class GetCompanyExpenseHandler(ICompanyExpenseReader reader, IStaffDirectory staff, IRequestContext requestContext)
{
    /// <summary>Reads one expense.</summary>
    /// <param name="id">The expense id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The expense, a 404 when it does not exist or was deleted, or a 401 when the token names no usable account.</returns>
    public async Task<Result<CompanyExpenseDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(AuthErrors.SessionEnded);
        }

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        if (view is null)
        {
            return Result.Failure<CompanyExpenseDetailResponse>(ExpenseErrors.NotFound);
        }

        var caller = await staff.GetStaffStateAsync(callerId, cancellationToken).ConfigureAwait(false);
        return Result.Success(CompanyExpenseDetailResponse.From(view, callerId, caller?.IsManager == true));
    }
}
