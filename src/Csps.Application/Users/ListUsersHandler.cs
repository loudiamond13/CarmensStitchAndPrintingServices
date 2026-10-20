using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager lists the staff roster (USER-01). The query is checked first and the port is never called for a
/// bad one. Blank search text means no search. Deleted people are not listed (D-09).
/// </summary>
public sealed class ListUsersHandler(IUserDirectory directory, IValidator<ListUsersRequest> validator, TimeProvider time)
{
    /// <summary>Lists one page of staff.</summary>
    /// <param name="request">The filters and page.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The page, or a 400 naming the bad fields.</returns>
    public async Task<Result<UserListResponse>> HandleAsync(ListUsersRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<UserListResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        var search = string.IsNullOrWhiteSpace(request.Q) ? null : request.Q.Trim();
        var role = request.Role switch
        {
            ListUsersRequestValidator.AdminRole => Roles.Admin,
            ListUsersRequestValidator.ManagerRole => Roles.Manager,
            _ => null,
        };

        var page = await directory
            .ListUsersAsync(new UserListQuery(search, role, request.Status, request.Page, request.PageSize), time.GetUtcNow(), cancellationToken)
            .ConfigureAwait(false);
        return Result.Success(new UserListResponse(page.Items, page.Total, request.Page, request.PageSize));
    }
}
