using System.Globalization;
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
/// Use case: create the first Manager of an empty system and email the invite that sets the password (AUTH-12, D-29).
/// It refuses with bootstrap.manager-exists while any active Manager exists, so a second privileged account cannot be
/// bootstrapped later (T-04-77).
/// The account has no password; the 72-hour, single-use link is the only way in, and sign-in still needs the emailed
/// code. One transaction creates the account, the token, the email and the audit entries (System actor), or none of it.
/// </summary>
public sealed class BootstrapManagerHandler(
    IUserAccounts accounts,
    IAccountTokens tokens,
    ISecureRandom random,
    IEmailOutbox outbox,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<BootstrapManagerCommand> validator,
    AuthSettings settings,
    TimeProvider time)
{
    private const string UserTarget = "User";

    /// <summary>Creates the Manager and queues the invite.</summary>
    /// <param name="command">The details.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new account id, a 400 for bad details, or a 422 when an active Manager exists or the address is taken.</returns>
    public async Task<Result<Guid>> HandleAsync(BootstrapManagerCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);

        var validation = await validator.ValidateAsync(command, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<Guid>(ValidationResults.ToError(validation, AuthErrors.ValidationCode, AuthErrors.ValidationMessage));
        }

        return await unitOfWork.InTransactionAsync(token => CreateAsync(command, token), cancellationToken).ConfigureAwait(false);
    }

    private static string Key(Guid id) => id.ToString("D", CultureInfo.InvariantCulture);

    private async Task<Result<Guid>> CreateAsync(BootstrapManagerCommand command, CancellationToken cancellationToken)
    {
        if (await accounts.AnyActiveManagerAsync(cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<Guid>(UserErrors.ManagerExists);
        }

        var email = command.Email!.Trim();
        if (await accounts.FindByEmailAsync(email, cancellationToken).ConfigureAwait(false) is not null)
        {
            return Result.Failure<Guid>(UserErrors.EmailTaken);
        }

        // The account is saved first (Identity saves on the shared context), then the token, email and audit together.
        var id = await accounts
            .CreateAsync(new NewUserAccount(email, command.FirstName!.Trim(), command.LastName!.Trim(), Roles.Manager, null), cancellationToken)
            .ConfigureAwait(false);

        var secret = random.NewToken();
        var now = time.GetUtcNow();
        var invitation = AccountToken.Create(id, AccountTokenPurpose.Invitation, TokenHash.Compute(secret), now, settings.InviteLinkLifetime);
        tokens.Add(invitation);
        await outbox.EnqueueAsync(new InviteEmail(email, secret, invitation.ExpiresAt, now), cancellationToken).ConfigureAwait(false);

        audit.Record(AuditActions.BootstrapManagerCreated, UserTarget, Key(id), null);
        audit.Record(AuditActions.UserInvited, UserTarget, Key(id), "bootstrap");
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(id);
    }
}
