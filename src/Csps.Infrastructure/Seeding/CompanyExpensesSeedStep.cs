using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Domain.Time;
using Csps.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Adds demo company expenses to an empty CompanyExpenses table so the local list has something to show (CEXP-01, PERF-04):
/// sixty dated over the business days before today and four up to thirty days ahead, with fixed plain descriptions and
/// invented amounts. Payer and recorder are the existing active staff with a password; the step never creates accounts or
/// categories (D-09). Everything is derived from the row number, so two runs on empty databases give the same rows.
/// </summary>
public sealed class CompanyExpensesSeedStep : ISeedStep
{
    private const int PastCount = 60;
    private const int UpcomingCount = 4;
    private const int PastSpanDays = 61;
    private const int UpcomingSpanDays = 30;

    private static readonly Template[] Templates =
    [
        new("Shop rent", "Rent", 10_000_00, 18_000_00),
        new("Electric bill", "Utilities", 2_000_00, 6_000_00),
        new("Staff salaries", "Salaries", 15_000_00, 25_000_00),
        new("Thread and needles", "Supplies", 150_00, 1_500_00),
        new("New heat press", "Equipment", 8_000_00, 22_000_00),
        new("Sewing machine repair", "Maintenance", 500_00, 3_500_00),
        new("Staff government contributions", "Government contributions", 3_000_00, 9_000_00),
        new("Business permit renewal", "Taxes and permits", 1_500_00, 7_500_00),
        new("Fuel for deliveries", "Transport and fuel", 400_00, 2_500_00),
        new("Packing tape and bags", "Others", 200_00, 1_200_00),
    ];

    /// <inheritdoc />
    public int Order => 300;

    /// <inheritdoc />
    public string Name => "CompanyExpenses";

    /// <inheritdoc />
    public async Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(time);

        if (await db.CompanyExpenses.IgnoreQueryFilters(["SoftDelete"]).AnyAsync(cancellationToken).ConfigureAwait(false))
        {
            return false;
        }

        var staff = await ReadPayersAsync(db, cancellationToken).ConfigureAwait(false);
        if (staff.Count == 0)
        {
            Console.WriteLine("  CompanyExpenses skipped: no active Admin or Manager with a password. Create one, then run the seed again.");
            return false;
        }

        var now = time.GetUtcNow();
        var (zone, source) = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana);
        var today = new BusinessClock(zone, source, now).Today;

        for (var index = 0; index < PastCount + UpcomingCount; index++)
        {
            var template = Templates[index % Templates.Length];
            var date = index < PastCount
                ? today.AddDays(-((index * 37 + 11) % PastSpanDays))
                : today.AddDays(1 + (index * 13 % UpcomingSpanDays));
            var cents = template.MinCents + ((index * 104_729) + 7_919) % (template.MaxCents - template.MinCents + 1);
            var payer = staff[index % staff.Count];
            var recorder = staff[((index / 2) + 1) % staff.Count];

            var created = CompanyExpense.Create(date, CategoryId(template.CategoryName), template.Description, cents / 100m, payer, null, today, now);
            if (created.IsFailure)
            {
                throw new InvalidOperationException($"A demo expense broke a rule: {created.Error.Message}");
            }

            var expense = created.Value;
            db.CompanyExpenses.Add(expense);

            // This context has no stamp interceptor, so the recorder and the time are set here.
            var entry = db.Entry(expense);
            entry.Property(nameof(CompanyExpense.CreatedById)).CurrentValue = recorder;
            entry.Property(nameof(CompanyExpense.CreatedAtUtc)).CurrentValue = now;
        }

        return true;
    }

    private static Guid CategoryId(string name) => ExpenseCategorySeed.Rows.Single(row => row.Name == name).Id;

    // D-32: an Admin or Manager who is active, not locked, not deleted and has a password.
    private static async Task<List<Guid>> ReadPayersAsync(CspsDbContext db, CancellationToken cancellationToken) =>
        await db.Users
            .AsNoTracking()
            .Where(user => user.IsActive && user.ManagerLockedAtUtc == null && user.DeletedAtUtc == null && user.PasswordHash != null)
            .Where(user => db.UserRoles.Any(link => link.UserId == user.Id && db.Roles.Any(role =>
                role.Id == link.RoleId && (role.Name == Roles.Admin || role.Name == Roles.Manager))))
            .OrderBy(user => user.NormalizedEmail)
            .ThenBy(user => user.Id)
            .Select(user => user.Id)
            .ToListAsync(cancellationToken)
            .ConfigureAwait(false);

    private sealed record Template(string Description, string CategoryName, int MinCents, int MaxCents);
}
