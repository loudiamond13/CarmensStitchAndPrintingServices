using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Email;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;
using FluentValidation;

namespace Csps.Application.Users;

/// <summary>
/// Use case: a Manager adds a staff member (USER-02, C-4, D-12..D-15). The default route creates the account with no password,
/// a 7-day single-use invitation link and an email that opens with the Manager's name. The other route creates the account
/// with the Manager's temporary password (basic rule only), marks it must-change and sends no email. One transaction creates the
/// account, the token, the email and the audit entry, or none of it. The new account's creator is the token's user, stamped by the
/// database layer (SEC-08); nothing in the request can name it. No name, email or secret reaches the audit trail.
/// </summary>
public sealed class CreateUserHandler(
    IUserAccounts accounts,
    IUserDirectory directory,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<CreateUserRequest> validator,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string ManagerDetail = "manager";

    /// <summary>Creates the person.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new id, a 400 on the fields that failed (a taken email is one), or a 401 when the token names no usable account.</returns>
    public async Task<Result<CreateUserResponse>> HandleAsync(CreateUserRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<CreateUserResponse>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        if (requestContext.UserId is not { } managerId
            || await directory.GetProfileAsync(managerId, cancellationToken).ConfigureAwait(false) is not { } manager)
        {
            return Result.Failure<CreateUserResponse>(AuthErrors.SessionEnded);
        }

        var email = request.Email!.Trim();
        if (await accounts.FindByEmailAsync(email, cancellationToken).ConfigureAwait(false) is { IsDeleted: false })
        {
            return Result.Failure<CreateUserResponse>(UserErrors.EmailInUse);
        }

        var invitedBy = $"{manager.FirstName} {manager.LastName}";
        var id = await unitOfWork
            .InTransactionAsync(token => CreateAsync(request, email, invitedBy, token), cancellationToken)
            .ConfigureAwait(false);
        return Result.Success(new CreateUserResponse(id));
    }

    private async Task<Guid> CreateAsync(CreateUserRequest request, string email, string invitedBy, CancellationToken cancellationToken)
    {
        var role = CreateUserRequestValidator.CanonicalRole(request.Role)!;
        var names = (First: request.FirstName!.Trim(), Last: request.LastName!.Trim());

        if (CreateUserRequestValidator.CanonicalAccess(request.Access) == CreateUserRequest.TemporaryPasswordAccess)
        {
            return await CreateWithTemporaryPasswordAsync(new NewUserAccount(email, names.First, names.Last, role, request.TemporaryPassword), cancellationToken).ConfigureAwait(false);
        }

        // The account is saved first (Identity saves on the shared context), then the token, email and audit together.
        var id = await accounts
            .CreateAsync(new NewUserAccount(email, names.First, names.Last, role, null), cancellationToken)
            .ConfigureAwait(false);

        var secret = random.NewToken();
        var now = time.GetUtcNow();
        var invitation = AccountToken.Create(id, AccountTokenPurpose.Invitation, TokenHash.Compute(secret), now, settings.InviteLinkLifetime);
        tokens.Add(invitation);
        await outbox.EnqueueAsync(new InviteEmail(email, secret, invitation.ExpiresAt, now, invitedBy), cancellationToken).ConfigureAwait(false);

        audit.Record(AuditActions.UserInvited, UserTarget, AuditKey.Of(id), ManagerDetail);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return id;
    }

    // The password is hashed by the account port and goes nowhere else: no email, token, audit detail or response holds it (D-14).
    private async Task<Guid> CreateWithTemporaryPasswordAsync(NewUserAccount account, CancellationToken cancellationToken)
    {
        var id = await accounts.CreateAsync(account, cancellationToken).ConfigureAwait(false);
        await accounts.SetMustChangePasswordAsync(id, PasswordChangeReason.Temporary, cancellationToken).ConfigureAwait(false);

        audit.Record(AuditActions.UserCreatedTemporary, UserTarget, AuditKey.Of(id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return id;
    }
}
