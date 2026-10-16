using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Identity;

namespace Csps.Application.Auth;

/// <summary>
/// Use case: list the caller's own signed-in devices (D-43). The user comes only from the access token, so nobody sees
/// another user's sessions (CWE-639). This device is first, then the others by recent activity.
/// </summary>
public sealed class ListSessionsHandler(ISessions sessions, IRequestContext requestContext, TimeProvider time)
{
    /// <summary>The most devices the list returns.</summary>
    public const int Cap = 100;

    /// <summary>Lists the caller's active sessions.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The sessions, or a 401 when the token names no user or session.</returns>
    public async Task<Result<IReadOnlyList<SessionListItem>>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } userId || requestContext.SessionId is not { } currentId)
        {
            return Result.Failure<IReadOnlyList<SessionListItem>>(AuthErrors.SessionEnded);
        }

        var now = time.GetUtcNow();
        var page = await sessions.ListActiveAsync(userId, now, Cap, cancellationToken).ConfigureAwait(false);
        var active = page.Where(session => session.IsActive(now)).ToList();

        // The store pages by activity, so an old current session can fall outside the page; it is always listed.
        if (active.All(session => session.Id != currentId))
        {
            var current = await sessions.FindAsync(currentId, cancellationToken).ConfigureAwait(false);
            if (current is not null && current.UserId == userId && current.IsActive(now))
            {
                active.Add(current);
            }
        }

        IReadOnlyList<SessionListItem> items =
        [
            .. active
                .OrderByDescending(session => session.Id == currentId)
                .ThenByDescending(session => session.LastActiveAt)
                .ThenByDescending(session => session.CreatedAt)
                .ThenBy(session => session.Id)
                .Take(Cap)
                .Select(session => new SessionListItem(
                    session.Id, session.DeviceLabel, session.CreatedAt, session.LastActiveAt, session.Persistent, session.Id == currentId)),
        ];
        return Result.Success(items);
    }
}
