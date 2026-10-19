using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Profile;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager edits another person's name, role and sign-in email (USER-03, USER-04, USER-05, D-45). The save carries the edit
/// version the form was opened with; any other version is refused with edit.stale and nothing changes (SEC-07, D-20). A Manager never
/// edits their own account here (D-19). Real changes are audited in the same transaction with field names and role values only, never a
/// name or address (USER-06, D-40): <c>user.details-changed</c> for names and email, <c>user.role-changed</c> for the role, never merged.
/// Saving values that already match is a success that writes and revokes nothing.
/// A role change ends every session of the person at once and evicts them from the session cache after the commit, so the old role
/// claim dies with the session. A role that is not Manager could take away an active Manager, so the roster lock is taken first,
/// before the target is read or Managers are counted, and a real demotion is checked by <see cref="ManagerGuard"/> (D-18).
/// A changed email follows the Manager's explicit choice (D-45), which the server never infers: <c>confirm</c> keeps the sign-in email,
/// stores the new address as pending and sends the person's new address a link that names the Manager, with a notice to the old address
/// (C-9); <c>now</c> moves the email in the same guarded save, ends every session, closes open email-change and password-reset links
/// (WR-01) and tells the old address. An invited person with no password yet always moves at once, and the invitation is replaced by a fresh one to the new address.
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
    TimeProvider time,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    AuthSettings settings)
{
    private const string UserTarget = "User";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The account to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The person as saved, a 400 for bad fields (a taken email and a missing choice for a changed email are two), a 401 when the token
    /// names no user, a 404 when the person does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 for the
    /// caller's own account or the last active Manager.
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
        var plan = new EditPlan(
            request.FirstName!.Trim(),
            request.LastName!.Trim(),
            CreateUserRequestValidator.CanonicalRole(request.Role)!,
            request.Email!.Trim(),
            CanonicalChoice(request.EmailChange));
        var outcome = await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => AttemptAsync(id, callerId, plan, version, token), cancellationToken),
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

    private static string? CanonicalChoice(string? choice) => choice?.Trim() switch
    {
        { } text when string.Equals(text, UpdateUserRequest.ConfirmByLink, StringComparison.OrdinalIgnoreCase) => UpdateUserRequest.ConfirmByLink,
        { } text when string.Equals(text, UpdateUserRequest.SaveAtOnce, StringComparison.OrdinalIgnoreCase) => UpdateUserRequest.SaveAtOnce,
        _ => null,
    };

    private async Task<Result<bool>> AttemptAsync(Guid id, Guid callerId, EditPlan plan, Guid version, CancellationToken cancellationToken)
    {
        // First, before anything is read: a second request waits here until the first has committed. Only a role other than Manager
        // can take a Manager away, and the person's current role cannot be read safely before the lock is held.
        if (!string.Equals(plan.Role, Roles.Manager, StringComparison.Ordinal))
        {
            await rosterLock.LockActiveManagersAsync(cancellationToken).ConfigureAwait(false);
        }

        var target = await accounts.FindByIdAsync(id, cancellationToken).ConfigureAwait(false);
        if (target is null || target.IsDeleted)
        {
            return Result.Failure<bool>(UserErrors.NotFound);
        }

        var demotes = string.Equals(target.Role, Roles.Manager, StringComparison.Ordinal)
            && !string.Equals(plan.Role, Roles.Manager, StringComparison.Ordinal);
        var allowed = await guard.CheckAsync(target, callerId, removesActiveManager: demotes, cancellationToken).ConfigureAwait(false);
        if (allowed.IsFailure)
        {
            return Result.Failure<bool>(allowed.Error);
        }

        // The choice only matters when the address really differs; the same address in another letter case is no change.
        var emailDiffers = !string.Equals(target.Email, plan.Email, StringComparison.OrdinalIgnoreCase);
        var managerName = string.Empty;
        if (emailDiffers)
        {
            if (plan.Choice is null)
            {
                return Result.Failure<bool>(UserErrors.EmailChangeChoiceRequired);
            }

            if (await accounts.FindByEmailAsync(plan.Email, cancellationToken).ConfigureAwait(false) is { IsDeleted: false } holder && holder.Id != id)
            {
                return Result.Failure<bool>(UserErrors.EmailInUse);
            }

            if (await directory.GetProfileAsync(callerId, cancellationToken).ConfigureAwait(false) is not { } manager)
            {
                return Result.Failure<bool>(AuthErrors.SessionEnded);
            }

            managerName = $"{manager.FirstName} {manager.LastName}";
        }

        // An invited person has nothing to confirm with, so their address always moves at once (D-45).
        var movesNow = emailDiffers && (!target.HasPassword || string.Equals(plan.Choice, UpdateUserRequest.SaveAtOnce, StringComparison.Ordinal));
        var change = new UserDetailsChange(plan.FirstName, plan.LastName, plan.Role, movesNow ? plan.Email : null);

        // Identity saves on the shared context, so it goes first; the revocation and the audit rows are added after it.
        var edit = await accounts.UpdateDetailsAsync(id, change, version, cancellationToken).ConfigureAwait(false);
        switch (edit.Outcome)
        {
            case EditOutcome.Stale:
                return Result.Failure<bool>(EditErrors.Stale);
            case EditOutcome.NotFound:
                return Result.Failure<bool>(UserErrors.NotFound);
            case EditOutcome.EmailTaken:
                return Result.Failure<bool>(UserErrors.EmailInUse);
            default:
                break;
        }

        var emailStep = !emailDiffers ? EmailStep.None : movesNow ? EmailStep.MoveNow : EmailStep.ConfirmByLink;
        if (edit.Outcome == EditOutcome.Unchanged && emailStep == EmailStep.None)
        {
            return Result.Success(false);
        }

        return await RecordAsync(target, edit, change, new EmailChange(emailStep, plan.Email, managerName), cancellationToken).ConfigureAwait(false);
    }

    private async Task<Result<bool>> RecordAsync(
        UserAccount target, DetailsEditResult edit, UserDetailsChange change, EmailChange email, CancellationToken cancellationToken)
    {
        var id = target.Id;
        var key = AuditKey.Of(id);
        var now = time.GetUtcNow();
        var detailFields = edit.ChangedFields.Where(static field => field != EditedFields.Role).ToList();
        if (detailFields.Count > 0)
        {
            audit.Record(AuditActions.UserDetailsChanged, UserTarget, key, "fields=" + string.Join(',', detailFields));
        }

        // An address that moved at once signs the person out, as a role change does; an invited person has no session to end.
        var roleChanged = edit.ChangedFields.Contains(EditedFields.Role);
        var emailMoved = email.Step == EmailStep.MoveNow && target.HasPassword;
        var revokeSessions = roleChanged || emailMoved;
        if (revokeSessions)
        {
            var revoked = await sessions
                .RevokeAllAsync(id, null, SessionRevocationReason.AccountChanged, now, cancellationToken).ConfigureAwait(false);

            if (roleChanged)
            {
                // Role values only, never a name (D-40).
                var detail = string.Create(CultureInfo.InvariantCulture, $"role={edit.PreviousRole?.ToLowerInvariant()}>{change.Role?.ToLowerInvariant()}");
                audit.Record(AuditActions.UserRoleChanged, UserTarget, key, detail);
            }

            if (revoked.Count > 0)
            {
                audit.Record(AuditActions.SessionsRevoked, UserTarget, key, AuditActions.DetailAccountChanged);
            }
        }

        if (email.Step != EmailStep.None)
        {
            await StartEmailAsync(target, email, now, cancellationToken).ConfigureAwait(false);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(revokeSessions);
    }

    private async Task StartEmailAsync(UserAccount target, EmailChange email, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var key = AuditKey.Of(target.Id);

        // The lock makes this and a racing link request for the same account run one after the other.
        await tokens.LockAccountAsync(target.Id, cancellationToken).ConfigureAwait(false);

        if (email.Step == EmailStep.MoveNow && !target.HasPassword)
        {
            // The old invitation link stops working and a fresh one goes to the new address.
            await tokens.RevokeOpenAsync(target.Id, AccountTokenPurpose.Invitation, now, cancellationToken).ConfigureAwait(false);
            var invite = random.NewToken();
            var invitation = AccountToken.Create(target.Id, AccountTokenPurpose.Invitation, TokenHash.Compute(invite), now, settings.InviteLinkLifetime);
            tokens.Add(invitation);
            await outbox.EnqueueAsync(new InviteEmail(email.NewEmail, invite, invitation.ExpiresAt, now, email.ManagerName), cancellationToken).ConfigureAwait(false);
            audit.Record(AuditActions.UserInvitationResent, UserTarget, key, null);
            return;
        }

        await tokens.RevokeOpenAsync(target.Id, AccountTokenPurpose.EmailChange, now, cancellationToken).ConfigureAwait(false);
        if (email.Step == EmailStep.MoveNow)
        {
            // A reset link sent to the old address must not outlive the move.
            await tokens.RevokeOpenAsync(target.Id, AccountTokenPurpose.PasswordReset, now, cancellationToken).ConfigureAwait(false);

            // The pending address was cleared in the same save as the move; the old address is told.
            await outbox.EnqueueAsync(new ManagerEmailChangedEmail(target.Email, email.NewEmail, email.ManagerName, now), cancellationToken).ConfigureAwait(false);
            return;
        }

        // Identity saves on the shared context, so the pending address goes first and the token, mail and audit follow together.
        await accounts.SetPendingEmailAsync(target.Id, email.NewEmail, cancellationToken).ConfigureAwait(false);
        var secret = random.NewToken();
        var created = AccountToken.Create(target.Id, AccountTokenPurpose.EmailChange, TokenHash.Compute(secret), now, settings.EmailChangeLinkLifetime);
        tokens.Add(created);
        await outbox
            .EnqueueAsync(new EmailChangeConfirmEmail(email.NewEmail, secret, created.ExpiresAt, now, target.Email, email.ManagerName), cancellationToken)
            .ConfigureAwait(false);
        await outbox
            .EnqueueAsync(new EmailChangeNoticeEmail(target.Email, email.NewEmail, now, DeviceSummary.Describe(requestContext.UserAgent)), cancellationToken)
            .ConfigureAwait(false);
        audit.Record(AuditActions.UserEmailChangeStarted, UserTarget, key, null);
    }

    private sealed record EditPlan(string FirstName, string LastName, string Role, string Email, string? Choice);

    private enum EmailStep
    {
        None,
        ConfirmByLink,
        MoveNow,
    }

    private sealed record EmailChange(EmailStep Step, string NewEmail, string ManagerName);
}
