using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: the new inbox confirms an email change (PROF-02, D-25). The link is a bearer token in the body, so the caller
/// needs no session. One transaction, under the per-account link lock, applies the pending address, spends the link and
/// any other open one, and audits the change by user id only. A malformed, unknown, used, replaced or expired link, a
/// blocked account and nothing pending all get the same 404 (CWE-640). When another account took the new address first
/// (D-24), the same transaction spends the link, clears the pending address and audits the cancel with the detail
/// <c>taken</c>, and the answer is the distinct 409 <c>email-change.taken</c>; the sign-in email is unchanged.
/// </summary>
public sealed class ConfirmEmailChangeHandler(
    IAccountTokens tokens,
    IUserAccounts accounts,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    private const string UserTarget = "User";
    private const string TakenDetail = "taken";

    /// <summary>Confirms one change.</summary>
    /// <param name="request">The token.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new sign-in email, a 404 for a link that does not work, or a 409 when the address was taken meanwhile or two saves lost a race.</returns>
    public async Task<Result<EmailChangeResponse>> HandleAsync(EmailChangeTokenRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        // The second pass of a lost race reads the link again, so a link spent by the winner reads as invalid.
        return await ConflictRetry
            .RunAsync(
                () => unitOfWork.InTransactionAsync(token => ConfirmAsync(request.Token, token), cancellationToken),
                Result.Failure<EmailChangeResponse>(AuthErrors.SessionBusy))
            .ConfigureAwait(false);
    }

    private async Task<Result<EmailChangeResponse>> ConfirmAsync(string? secret, CancellationToken cancellationToken)
    {
        var now = time.GetUtcNow();
        if (!AccountLinkLookup.IsWellFormed(secret))
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        var stored = await tokens.FindByHashAsync(TokenHash.Compute(secret!), AccountTokenPurpose.EmailChange, cancellationToken).ConfigureAwait(false);
        if (stored is null || !stored.IsUsable(now))
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        var account = await accounts.FindByIdAsync(stored.UserId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        // A request that waited here for the winner finds nothing pending and reads as an invalid link.
        await tokens.LockAccountAsync(account.Id, cancellationToken).ConfigureAwait(false);
        var outcome = await accounts.ApplyPendingEmailAsync(account.Id, cancellationToken).ConfigureAwait(false);
        if (outcome == EmailApplyOutcome.Taken)
        {
            return await DropTakenAsync(stored, account.Id, now, cancellationToken).ConfigureAwait(false);
        }

        if (outcome != EmailApplyOutcome.Applied)
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        stored.Use(now);
        await tokens.RevokeOpenAsync(account.Id, AccountTokenPurpose.EmailChange, now, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChanged, UserTarget, AuditKey.Of(account.Id), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);

        var changed = await accounts.FindByIdAsync(account.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success(new EmailChangeResponse(changed!.Email));
    }

    // The address is gone for good, so the link is spent and the pending change is cleared; the account stays as it was.
    private async Task<Result<EmailChangeResponse>> DropTakenAsync(AccountToken stored, Guid userId, DateTimeOffset now, CancellationToken cancellationToken)
    {
        await accounts.SetPendingEmailAsync(userId, null, cancellationToken).ConfigureAwait(false);
        stored.Use(now);
        await tokens.RevokeOpenAsync(userId, AccountTokenPurpose.EmailChange, now, cancellationToken).ConfigureAwait(false);
        audit.Record(AuditActions.ProfileEmailChangeCanceled, UserTarget, AuditKey.Of(userId), TakenDetail);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Taken);
    }
}
