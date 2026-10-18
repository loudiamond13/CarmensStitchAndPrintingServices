using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: read the caller's own profile (PROF-01). The user comes only from the access token, so nobody reads
/// another account (CWE-639). Names come from the user row itself (D-08).
/// </summary>
public sealed class GetProfileHandler(IUserDirectory directory, IRequestContext requestContext)
{
    /// <summary>Reads the profile.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The profile, or a 401 when the token names no existing account.</returns>
    public async Task<Result<ProfileResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var view = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ProfileResponse>(AuthErrors.SessionEnded)
            : Result.Success(ProfileResponse.From(view));
    }
}
