using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the caller changes their own first and last name (PROF-01). The save carries the edit version the form
/// was opened with; any other version is refused with edit.stale and nothing changes (SEC-07, D-20). The target is
/// always the token's user (CWE-639).
/// </summary>
public sealed class UpdateProfileNameHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IRequestContext requestContext,
    IValidator<UpdateProfileNameRequest> validator)
{
    /// <summary>Saves the name.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The saved profile, a 400 for bad fields, a 409 for a stale version, or a 401 when the token names no account.</returns>
    public async Task<Result<ProfileResponse>> HandleAsync(UpdateProfileNameRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } userId)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ProfileResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        _ = UpdateProfileNameRequestValidator.TryParseVersion(request.Version, out var version);
        var edit = await accounts
            .UpdateNameAsync(userId, request.FirstName!.Trim(), request.LastName!.Trim(), version, cancellationToken)
            .ConfigureAwait(false);
        if (edit.Outcome == EditOutcome.Stale)
        {
            return Result.Failure<ProfileResponse>(EditErrors.Stale);
        }

        if (edit.Outcome == EditOutcome.NotFound)
        {
            return Result.Failure<ProfileResponse>(AuthErrors.SessionEnded);
        }

        var view = await directory.GetProfileAsync(userId, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<ProfileResponse>(AuthErrors.SessionEnded)
            : Result.Success(ProfileResponse.From(view));
    }
}
