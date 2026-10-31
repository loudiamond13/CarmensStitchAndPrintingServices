using Csps.Application.Ports;
using Csps.Application.Users;
using Csps.Domain.Identity;
using Csps.Infrastructure.Common;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IUserDirectory"/> over the Identity tables: untracked reads, so nothing is saved by accident.</summary>
internal sealed class UserDirectory(CspsDbContext context) : IUserDirectory
{
    public async Task<ProfileView?> GetProfileAsync(Guid userId, CancellationToken cancellationToken)
    {
        var row = await context.Users
            .AsNoTracking()
            .Where(user => user.Id == userId && user.DeletedAtUtc == null)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                Role = (from userRole in context.UserRoles
                        join role in context.Roles on userRole.RoleId equals role.Id
                        where userRole.UserId == user.Id
                        orderby role.Name
                        select role.Name).FirstOrDefault(),
                user.PendingEmail,
                user.CreatedAtUtc,
                user.EditVersion,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return row is null
            ? null
            : new ProfileView(row.Id, row.FirstName, row.LastName, row.Email ?? string.Empty, row.Role ?? string.Empty, row.PendingEmail, row.CreatedAtUtc, row.EditVersion);
    }

    public async Task<UserListPage> ListUsersAsync(UserListQuery query, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        // D-37: the Legacy / unassigned holder is never a roster row and never in the total.
        var matches = Filter(context.Users.AsNoTracking().Where(user => user.DeletedAtUtc == null && user.Id != LegacyHolder.Id), query);
        var total = await matches.CountAsync(cancellationToken).ConfigureAwait(false);

        var rows = await matches
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ThenBy(user => user.Id)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                Role = (from userRole in context.UserRoles
                        join role in context.Roles on userRole.RoleId equals role.Id
                        where userRole.UserId == user.Id
                        orderby role.Name
                        select role.Name).FirstOrDefault(),
                user.IsActive,
                Locked = user.ManagerLockedAtUtc != null,
                HasPassword = user.PasswordHash != null,
                LiveInvitation = context.AccountTokens.Any(token =>
                    token.UserId == user.Id
                    && token.Purpose == AccountTokenPurpose.Invitation
                    && token.UsedAt == null
                    && token.RevokedAt == null
                    && token.ExpiresAt > now),
                user.CreatedAtUtc,
            })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        IReadOnlyList<UserListItem> items =
        [
            .. rows.Select(row => new UserListItem(
                row.Id,
                row.FirstName,
                row.LastName,
                row.Email ?? string.Empty,
                row.Role ?? string.Empty,
                UserStatuses.Of(row.IsActive, row.Locked),
                InviteStates.Of(row.HasPassword, row.LiveInvitation),
                row.CreatedAtUtc)),
        ];
        return new UserListPage(items, total);
    }

    public async Task<UserDetailView?> GetUserAsync(Guid id, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var row = await context.Users
            .AsNoTracking()
            .Where(user => user.Id == id && user.Id != LegacyHolder.Id && user.DeletedAtUtc == null)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                user.Email,
                Role = (from userRole in context.UserRoles
                        join role in context.Roles on userRole.RoleId equals role.Id
                        where userRole.UserId == user.Id
                        orderby role.Name
                        select role.Name).FirstOrDefault(),
                user.IsActive,
                Locked = user.ManagerLockedAtUtc != null,
                HasPassword = user.PasswordHash != null,
                LiveInvitation = context.AccountTokens.Any(token =>
                    token.UserId == user.Id
                    && token.Purpose == AccountTokenPurpose.Invitation
                    && token.UsedAt == null
                    && token.RevokedAt == null
                    && token.ExpiresAt > now),
                user.CreatedAtUtc,
                user.PendingEmail,
                user.UpdatedAtUtc,
                user.EditVersion,
                user.CreatedById,
                user.UpdatedById,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);
        if (row is null)
        {
            return null;
        }

        // Each actor is read from their own row now, so a rename shows at once; a deleted actor keeps their name (D-08, D-11).
        var actorIds = new[] { row.CreatedById, row.UpdatedById }.OfType<Guid>().Distinct().ToList();
        var actors = actorIds.Count == 0
            ? []
            : await context.Users
                .AsNoTracking()
                .Where(actor => actorIds.Contains(actor.Id))
                .Select(actor => new { actor.Id, actor.FirstName, actor.LastName, Former = actor.DeletedAtUtc != null })
                .ToDictionaryAsync(actor => actor.Id, cancellationToken)
                .ConfigureAwait(false);

        ActorRef? ActorOf(Guid? actorId) =>
            actorId is { } known && actors.TryGetValue(known, out var actor)
                ? new ActorRef(actor.Id, $"{actor.FirstName} {actor.LastName}", actor.Former)
                : null;

        return new UserDetailView(
            row.Id,
            row.FirstName,
            row.LastName,
            row.Email ?? string.Empty,
            row.Role ?? string.Empty,
            UserStatuses.Of(row.IsActive, row.Locked),
            InviteStates.Of(row.HasPassword, row.LiveInvitation),
            row.CreatedAtUtc,
            row.HasPassword,
            row.Locked,
            row.PendingEmail,
            row.UpdatedAtUtc,
            row.EditVersion,
            ActorOf(row.CreatedById),
            ActorOf(row.UpdatedById));
    }

    private IQueryable<ApplicationUser> Filter(IQueryable<ApplicationUser> users, UserListQuery query)
    {
        if (query.Role is { } roleName)
        {
            users = users.Where(user => context.UserRoles.Any(userRole =>
                userRole.UserId == user.Id && context.Roles.Any(role => role.Id == userRole.RoleId && role.Name == roleName)));
        }

        users = query.Status switch
        {
            UserStatuses.Inactive => users.Where(user => !user.IsActive),
            UserStatuses.Locked => users.Where(user => user.IsActive && user.ManagerLockedAtUtc != null),
            UserStatuses.Active => users.Where(user => user.IsActive && user.ManagerLockedAtUtc == null),
            _ => users,
        };

        if (query.Search is { } search)
        {
            var pattern = LikePattern.Contains(search);
            users = users.Where(user =>
                EF.Functions.Like(user.FirstName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(user.LastName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(user.FirstName + " " + user.LastName, pattern, LikePattern.EscapeCharacter)
                || EF.Functions.Like(user.Email!, pattern, LikePattern.EscapeCharacter));
        }

        return users;
    }

}
