using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Profile;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager edits another person's name and role (USER-03, USER-04, USER-05). The save carries the edit version the form was
/// opened with; any other version is refused with edit.stale and nothing changes (SEC-07, D-20). A Manager never edits their own account
/// here (D-19). Real changes are audited in the same transaction with field names and role values only, never a name (USER-06, D-40):
/// <c>user.details-changed</c> for names and <c>user.role-changed</c> for the role, never merged. Saving values that already match is a
/// success that writes and revokes nothing.
/// A role change ends every session of the person at once and evicts them from the session cache after the commit, so the old role
/// claim dies with the session. A role that is not Manager could take away an active Manager, so the roster lock is taken first,
/// before the target is read or Managers are counted, and a real demotion is checked by <see cref="ManagerGuard"/> (D-18).
/// </summary>
public sealed class UpdateUserHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    ISessions sessions,
    ISessionCache sessionCache,
    IManagerRosterLock rosterLock,
    ManagerGuard guard,
    IRequestContext requestContext,
    IValidator<UpdateUserRequest> validator,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string AccountChangedDetail = "account-changed";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The account to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The person as saved, a 400 for bad fields, a 401 when the token names no user, a 404 when the person does not exist or was
    /// deleted, a 409 for a stale version or a lost race, or a 422 for the caller's own account or the last active Manager.
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
        var change = new UserDetailsChange(
            request.FirstName!.Trim(),
            request.LastName!.Trim(),
            CreateUserRequestValidator.CanonicalRole(request.Role));
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, callerId, change, version, token), cancellationToken),
                Result.Failure<bool>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
        if (outcome.IsFailure)
        {
            return Result.Failure<UserDetailResponse>(outcome.Error);
        }

        // After the commit, so the next request reads the revoked sessions and not a cached "active" answer.
        if (outcome.Value)
        {
            await sessionCache.EvictUserAsync(id, cancellationToken).ConfigureAwait(false);
        }

        var view = await directory.GetUserAsync(id, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<UserDetailResponse>(UserErrors.NotFound)
            : Result.Success(UserDetailResponse.From(view));
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, UserDetailsChange change, Guid version, CancellationToken cancellationToken)
    {
        // First, before anything is read: a second request waits here until the first has committed. Only a role other than Manager
        // can take a Manager away, and the person's current role cannot be read safely before the lock is held.
        if (!string.Equals(change.Role, Roles.Manager, StringComparison.Ordinal))
        {
            await rosterLock.LockActiveManagersAsync(cancellationToken).ConfigureAwait(false);
        }

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        var demotes = string.Equals(target.Role, Roles.Manager, StringComparison.Ordinal)
            && !string.Equals(change.Role, Roles.Manager, StringComparison.Ordinal);
        var allowed = await guard.CheckAsync(target, callerId, removesActiveManager: demotes, cancellationToken).ConfigureAwait(false);
        if (allowed.IsFailure)
        {
            return Result.Failure<bool>(allowed.Error);
        }

        // Identity saves on the shared context, so it goes first; the revocation and the audit rows are added after it.
        var edit = await accounts.UpdateDetailsAsync(id, change, version, cancellationToken).ConfigureAwait(false);
        switch (edit.Outcome)
        {
            case EditOutcome.Stale:
                return Result.Failure<bool>(EditErrors.Stale);
            case EditOutcome.NotFound:
                return Result.Failure<bool>(UserErrors.NotFound);
            case EditOutcome.Unchanged:
                return Result.Success(false);
            default:
                return await RecordAsync(id, edit, change, cancellationToken).ConfigureAwait(false);
        }
    }

    private async Task<Result<bool>> RecordAsync(Guid id, DetailsEditResult edit, UserDetailsChange change, CancellationToken cancellationToken)
    {
        var key = AuditKey.Of(id);
        var nameFields = edit.ChangedFields.Where(static field => field != EditedFields.Role).ToList();
        if (nameFields.Count > 0)
        {
            audit.Record(AuditActions.UserDetailsChanged, UserTarget, key, "fields=" + string.Join(',', nameFields));
        }

        var roleChanged = edit.ChangedFields.Contains(EditedFields.Role);
        if (roleChanged)
        {
            var revoked = await sessions
                .RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);

            // Role values only, never a name (D-40).
            var detail = string.Create(CultureInfo.InvariantCulture, $"role={edit.PreviousRole?.ToLowerInvariant()}>{change.Role?.ToLowerInvariant()}");
            audit.Record(AuditActions.UserRoleChanged, UserTarget, key, detail);
            if (revoked.Count > 0)
            {
                audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AccountChangedDetail);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(roleChanged);
    }
}
