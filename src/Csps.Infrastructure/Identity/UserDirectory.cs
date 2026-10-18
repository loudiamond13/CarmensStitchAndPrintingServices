using Csps.Application.Ports;
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
}
