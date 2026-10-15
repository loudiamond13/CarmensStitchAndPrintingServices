using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: tell the reset page whether its link still works and whose account it is for (AUTH-08). A malformed,
/// unknown, used, revoked or expired token and a deactivated account all get the same answer, so a link reveals
/// nothing beyond "expired" (CWE-640).
/// </summary>
public sealed class CheckResetLinkHandler(
    IAccountTokens tokens,
    IUserAccounts accounts,
    IAuditTrail audit,
    TimeProvider time)
{
    /// <summary>Checks one link.</summary>
    /// <param name="request">The token.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The account email, or a 404 for any link that does not work.</returns>
    public async Task<Result<ResetLinkResponse>> HandleAsync(ResetTokenRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var link = await ResetLinkLookup.FindAsync(request.Token, time.GetUtcNow(), tokens, accounts, cancellationToken).ConfigureAwait(false);
        if (link is null)
        {
            await audit.RecordIndependentlyAsync(AuditActions.PasswordResetLinkInvalid, null, null, null, cancellationToken).ConfigureAwait(false);
            return Result.Failure<ResetLinkResponse>(AuthErrors.LinkInvalid);
        }

        return Result.Success(new ResetLinkResponse(link.Account.Email));
    }
}
