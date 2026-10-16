using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: sign out this device (AUTH-06). The session behind the refresh cookie is revoked and evicted so its access
/// token stops working at once. A missing, unknown or already ended session is still a success.
/// </summary>
public sealed class SignOutHandler(
    ISessions sessions,
    ISessionCache sessionCache,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time)
{
    /// <summary>Signs out the session of a refresh cookie.</summary>
    /// <param name="refreshToken">The raw token from the refresh cookie; null or empty when the cookie is missing.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, or a 409 when two saves in a row lost a race (nothing was signed out).</returns>
    public async Task<Result> HandleAsync(string? refreshToken, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(refreshToken))
        {
            return Result.Success();
        }

        var hash = TokenHash.Compute(refreshToken);
        return await ConflictRetry.RunAsync(() => AttemptAsync(hash, cancellationToken), Result.Failure(AuthErrors.SessionBusy)).ConfigureAwait(false);
    }

    private async Task<Result> AttemptAsync(byte[] hash, CancellationToken cancellationToken)
    {
        var lookup = await sessions.FindByRefreshHashAsync(hash, cancellationToken).ConfigureAwait(false);
        if (lookup is null || lookup.Session.RevokedAt is not null)
        {
            return Result.Success();
        }

        var session = lookup.Session;
        session.Revoke(SessionRevocationReason.SignedOut, time.GetUtcNow(), lookup.Related);
        audit.Record(AuditActions.SignedOut, "UserSession", session.Id.ToString("D", CultureInfo.InvariantCulture), null);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        await sessionCache.EvictAsync(session.Id, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
