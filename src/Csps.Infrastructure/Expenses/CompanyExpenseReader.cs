using Csps.Application.Expenses;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Application.Users;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Expenses;

/// <summary><see cref="ICompanyExpenseReader"/> over EF: untracked reads, one statement per read.</summary>
internal sealed class CompanyExpenseReader(CspsDbContext context) : ICompanyExpenseReader
{
    public async Task<CompanyExpenseDetailView?> GetDetailAsync(Guid id, CancellationToken cancellationToken)
    {
        // The named SoftDelete filter hides a deleted expense. The payer, recorder and last changer come from their own
        // user rows, so a rename shows at once and a deleted person keeps their name (D-08, D-11).
        var row = await (
            from expense in context.CompanyExpenses.AsNoTracking()
            where expense.Id == id
            join category in context.ExpenseCategories on expense.CategoryId equals category.Id
            join payer in context.Users on expense.PaidByUserId equals payer.Id
            join recorderUser in context.Users on expense.CreatedById equals (Guid?)recorderUser.Id into recorders
            from recorder in recorders.DefaultIfEmpty()
            join changerUser in context.Users on expense.UpdatedById equals (Guid?)changerUser.Id into changers
            from changer in changers.DefaultIfEmpty()
            select new
            {
                expense.Id,
                expense.ExpenseDate,
                expense.CategoryId,
                expense.Description,
                expense.Amount,
                expense.Notes,
                expense.PaidByUserId,
                expense.CreatedById,
                expense.CreatedAtUtc,
                expense.UpdatedAtUtc,
                expense.RowVersion,
                CategoryName = category.Name,
                CategoryTone = category.Tone,
                CategoryRetired = category.RetiredAtUtc != null,
                PayerFirst = payer.FirstName,
                PayerLast = payer.LastName,
                PayerFormer = payer.DeletedAtUtc != null,

                // D-32, the same set as StaffState.CanPay, evaluated in SQL.
                PayerActive = payer.IsActive
                    && payer.ManagerLockedAtUtc == null
                    && payer.DeletedAtUtc == null
                    && payer.PasswordHash != null
                    && context.UserRoles.Any(link => link.UserId == payer.Id && context.Roles.Any(role =>
                        role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))),
                RecorderFirst = (string?)recorder.FirstName,
                RecorderLast = (string?)recorder.LastName,
                RecorderFormer = recorder.DeletedAtUtc != null,
                ChangerId = (Guid?)changer.Id,
                ChangerFirst = (string?)changer.FirstName,
                ChangerLast = (string?)changer.LastName,
                ChangerFormer = changer.DeletedAtUtc != null,
            })
            .SingleOrDefaultAsync(cancellationToken)
            .ConfigureAwait(false);

        if (row is null)
        {
            return null;
        }

        return new CompanyExpenseDetailView(
            row.Id,
            row.ExpenseDate,
            new ExpenseCategoryRef(row.CategoryId, row.CategoryName, row.CategoryTone, row.CategoryRetired),
            row.Description,
            row.Amount,
            row.Notes,
            new ActorRef(row.PaidByUserId, $"{row.PayerFirst} {row.PayerLast}", row.PayerFormer),
            row.PayerActive,
            row.CreatedById is { } creator && row.RecorderFirst is not null
                ? new ActorRef(creator, $"{row.RecorderFirst} {row.RecorderLast}", row.RecorderFormer)
                : null,
            row.CreatedAtUtc,
            row.ChangerId is { } changed && row.ChangerFirst is not null
                ? new ActorRef(changed, $"{row.ChangerFirst} {row.ChangerLast}", row.ChangerFormer)
                : null,
            row.UpdatedAtUtc,
            row.RowVersion,
            row.CreatedById,
            row.PaidByUserId);
    }
}
