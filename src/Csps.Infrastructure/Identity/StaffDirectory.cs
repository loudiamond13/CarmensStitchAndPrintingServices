using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Staff;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Identity;

/// <summary><see cref="IStaffDirectory"/> over the Identity tables: one untracked statement per read, names and flags only.</summary>
internal sealed class StaffDirectory(CspsDbContext context) : IStaffDirectory
{
    public async Task<IReadOnlyList<StaffMember>> ListActiveStaffAsync(CancellationToken cancellationToken)
    {
        // D-32, A-06-01: "set up" means has a password (PasswordHash != null). Keep this clause and HasPassword below in step.
        var rows = await context.Users
            .AsNoTracking()
            .Where(user => user.IsActive && user.ManagerLockedAtUtc == null && user.DeletedAtUtc == null && user.PasswordHash != null)
            .Where(user => context.UserRoles.Any(link => link.UserId == user.Id && context.Roles.Any(role =>
                role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))))
            .OrderBy(user => user.FirstName)
            .ThenBy(user => user.LastName)
            .ThenBy(user => user.Id)
            .Select(user => new { user.Id, user.FirstName, user.LastName })
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

        return [.. rows.Select(row => new StaffMember(row.Id, $"{row.FirstName} {row.LastName}"))];
    }

    public async Task<StaffState?> GetStaffStateAsync(Guid id, CancellationToken cancellationToken)
    {
        var row = await context.Users
            .AsNoTracking()
            .Where(user => user.Id == id)
            .Select(user => new
            {
                user.Id,
                user.FirstName,
                user.LastName,
                Role = (from userRole in context.UserRoles
                        join role in context.Roles on userRole.RoleId equals role.Id
                        where userRole.UserId == user.Id
                        orderby role.Name
                        select role.Name).FirstOrDefault(),
                user.IsActive,
                Locked = user.ManagerLockedAtUtc != null,
                Deleted = user.DeletedAtUtc != null,
                // D-32, A-06-01: the same set-up check as the list filter above.
                HasPassword = user.PasswordHash != null,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        return row is null
            ? null
            : new StaffState(row.Id, $"{row.FirstName} {row.LastName}", row.Role, row.IsActive, row.Locked, row.Deleted, row.HasPassword);
    }
}
