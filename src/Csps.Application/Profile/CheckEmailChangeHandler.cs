using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Profile;

/// <summary>
/// Use case: tell the confirm-email page whether its link still works and which address it would confirm (D-25). It only
/// reads: it never spends the link and never changes the account, so a mail scanner that opens the page confirms nothing
/// (T-05-39). A malformed, unknown, used, replaced, expired or other-purpose link, a blocked account and an account with
/// nothing pending all get the same 404 (CWE-640). A link whose new address another live account has taken since gets the
/// distinct 409 <c>email-change.taken</c>, which only the holder of the link ever sees (T-05-41).
/// </summary>
public sealed class CheckEmailChangeHandler(IAccountTokens tokens, IUserAccounts accounts, IUserDirectory directory, TimeProvider time)
{
    /// <summary>Checks one email-change link.</summary>
    /// <param name="request">The token.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The address the link would confirm, a 404 for a link that does not work, or a 409 when the address was taken meanwhile.</returns>
    public async Task<Result<EmailChangeResponse>> HandleAsync(EmailChangeTokenRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (!AccountLinkLookup.IsWellFormed(request.Token))
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        var stored = await tokens.FindByHashAsync(TokenHash.Compute(request.Token!), AccountTokenPurpose.EmailChange, cancellationToken).ConfigureAwait(false);
        if (stored is null || !stored.IsUsable(time.GetUtcNow()))
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        var account = await accounts.FindByIdAsync(stored.UserId, cancellationToken).ConfigureAwait(false);
        if (account is null || account.IsBlocked)
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        var profile = await directory.GetProfileAsync(account.Id, cancellationToken).ConfigureAwait(false);
        if (profile?.PendingEmail is not { Length: > 0 } pending)
        {
            return Result.Failure<EmailChangeResponse>(EmailChangeErrors.Invalid);
        }

        // A deleted account's address is scrambled, so only a live account can hold it.
        return await accounts.FindByEmailAsync(pending, cancellationToken).ConfigureAwait(false) is { IsDeleted: false }
            ? Result.Failure<EmailChangeResponse>(EmailChangeErrors.Taken)
            : Result.Success(new EmailChangeResponse(pending));
    }
}
