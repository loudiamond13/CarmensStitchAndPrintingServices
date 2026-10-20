using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager reads one person (USER-01, SEC-08). A deleted or unknown person is the same 404 (D-09).
/// </summary>
public sealed class GetUserHandler(IUserDirectory directory, TimeProvider time)
{
    /// <summary>Reads one person.</summary>
    /// <param name="id">The account id.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The person, or a 404 when the account does not exist or was deleted.</returns>
    public async Task<Result<UserDetailResponse>> HandleAsync(Guid id, CancellationToken cancellationToken)
    {
        var view = await directory.GetUserAsync(id, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<UserDetailResponse>(UserErrors.NotFound)
            : Result.Success(UserDetailResponse.From(view));
    }
}
