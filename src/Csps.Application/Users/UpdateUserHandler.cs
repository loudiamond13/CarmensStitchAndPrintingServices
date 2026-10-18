using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Profile;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager edits another person's name (USER-03). The save carries the edit version the form was opened with; any other
/// version is refused with edit.stale and nothing changes (SEC-07, D-20). A Manager never edits their own account here (D-19). A
/// real change is audited in the same transaction with the changed field names only, never a name (USER-06, D-40). Saving values that
/// already match is a success that writes nothing.
/// </summary>
public sealed class UpdateUserHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IRequestContext requestContext,
    IValidator<UpdateUserRequest> validator,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The account to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The person as saved, a 400 for bad fields, a 401 when the token names no user, a 404 when the person does not exist or was
    /// deleted, a 409 for a stale version or a lost race, or a 422 for the caller's own account.
    /// </returns>
    public async Task<Result<UserDetailResponse>> HandleAsync(Guid id, UpdateUserRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<UserDetailResponse>(AuthErrors.SessionEnded);
        }

        if (id == callerId)
        {
            return Result.Failure<UserDetailResponse>(UserErrors.OwnAccount);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<UserDetailResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        _ = UpdateProfileNameRequestValidator.TryParseVersion(request.Version, out var version);
        var change = new UserDetailsChange(request.FirstName!.Trim(), request.LastName!.Trim());
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, change, version, token), cancellationToken),
                Result.Failure(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure<UserDetailResponse>(outcome.Error);
        }

        var view = await directory.GetUserAsync(id, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<UserDetailResponse>(UserErrors.NotFound)
            : Result.Success(UserDetailResponse.From(view));
    }

    private async Task<Result> AttemptAsync(Guid id, UserDetailsChange change, Guid version, CancellationToken cancellationToken)
    {
        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure(UserErrors.NotFound);
        }

        var edit = await accounts.UpdateDetailsAsync(id, change, version, cancellationToken).ConfigureAwait(false);
        switch (edit.Outcome)
        {
            case EditOutcome.Stale:
                return Result.Failure(EditErrors.Stale);
            case EditOutcome.NotFound:
                return Result.Failure(UserErrors.NotFound);
            case EditOutcome.Unchanged:
                return Result.Success();
            default:
                audit.Record(AuditActions.UserDetailsChanged, UserTarget, AuditKey.Of(id), "fields=" + string.Join(',', edit.ChangedFields));
                await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
                return Result.Success();
        }
    }
}
