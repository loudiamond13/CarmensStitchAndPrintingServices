using Csps.Domain.Expenses;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>
/// Builds about five years of fake expenses for the speed check (D-28): 20 a day, ten categories, six staff as payers and
/// recorders, 2% soft-deleted. It uses EF <c>AddRange</c> in batches (no SQL strings) and a seeded random, so every run is the same.
/// It only ever writes through the <see cref="CspsDatabase"/> it is given, which is a throwaway CSPS_Test database.
/// </summary>
internal static class ExpenseTimingData
{
    /// <summary>Expenses made per day.</summary>
    public const int PerDay = 20;

    /// <summary>Days of history, ending on the business today.</summary>
    public const int Days = 1826;

    private const int BatchSize = 1000;
    private const uint RandomSeed = 20261025;

    private static readonly string[] FirstNames = ["Alma", "Benito", "Carla", "Dante", "Elena", "Felix"];
    private static readonly string[] LastNames = ["Cruz", "Reyes", "Santos", "Garcia", "Mendoza", "Bautista"];
    private static readonly string[] Things = ["Thread", "Fabric", "Ink", "Electricity", "Rent", "Repair", "Courier", "Needles", "Paper", "Transfers"];

    /// <summary>Writes the staff and the expenses.</summary>
    /// <param name="database">The throwaway test database.</param>
    /// <param name="today">The business today; the last day of the history.</param>
    /// <param name="recorded">Any fixed instant, which makes the keys and the recorded times.</param>
    /// <returns>The first name that the search scenario looks for, and how many rows were written.</returns>
    public static async Task<TimingDataSummary> BuildAsync(CspsDatabase database, DateOnly today, DateTimeOffset recorded)
    {
        ArgumentNullException.ThrowIfNull(database);
        var staff = await AddStaffAsync(database).ConfigureAwait(false);
        var categories = ExpenseCategorySeed.Rows.Select(row => row.Id).ToArray();
        var random = new Sequence(RandomSeed);
        var written = 0;

        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var pending = 0;
            for (var offset = Days - 1; offset >= 0; offset--)
            {
                var date = today.AddDays(-offset);
                for (var slot = 0; slot < PerDay; slot++)
                {
                    AddExpense(context, random, date, slot, staff, categories, today, recorded);
                    pending++;
                    written++;
                    if (pending == BatchSize)
                    {
                        await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
                        context.ChangeTracker.Clear();
                        pending = 0;
                    }
                }
            }

            if (pending > 0)
            {
                await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
                context.ChangeTracker.Clear();
            }
        }

        return new TimingDataSummary(FirstNames[1], written);
    }

    private static void AddExpense(
        CspsDbContext context, Sequence random, DateOnly date, int slot, Guid[] staff, Guid[] categories, DateOnly today, DateTimeOffset recorded)
    {
        var payer = staff[random.Next(staff.Length)];
        var recorder = staff[random.Next(staff.Length)];
        var category = categories[random.Next(categories.Length)];
        var amount = random.Next(1000, 5_000_000) / 100m;
        var description = $"{Things[random.Next(Things.Length)]} {date:yyyy-MM-dd} {slot:00}";
        var expense = CompanyExpense.Create(date, category, description, amount, payer, null, today, recorded).Value;
        context.CompanyExpenses.Add(expense);

        var at = new DateTimeOffset(date.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero).AddHours(2).AddMinutes(slot);
        var entry = context.Entry(expense);
        entry.Property(row => row.CreatedById).CurrentValue = recorder;
        entry.Property(row => row.CreatedAtUtc).CurrentValue = at;
        if (random.Next(100) < 2)
        {
            entry.Property(row => row.DeletedAtUtc).CurrentValue = at.AddMinutes(30);
            entry.Property(row => row.DeletedById).CurrentValue = recorder;
        }
    }

    private static async Task<Guid[]> AddStaffAsync(CspsDatabase database)
    {
        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            var ids = new List<Guid>();
            for (var index = 0; index < FirstNames.Length; index++)
            {
                var email = $"timing.{Guid.NewGuid():N}@example.com";
                var user = new ApplicationUser
                {
                    Id = Guid.NewGuid(),
                    UserName = email,
                    NormalizedUserName = email.ToUpperInvariant(),
                    Email = email,
                    NormalizedEmail = email.ToUpperInvariant(),
                    FirstName = FirstNames[index],
                    LastName = LastNames[index],
                };
                context.Users.Add(user);
                ids.Add(user.Id);
            }

            await context.SaveChangesAsync(TestContext.Current.CancellationToken).ConfigureAwait(false);
            return [.. ids];
        }
    }
}

/// <summary>What the data builder wrote.</summary>
/// <param name="SearchName">A first name that the search scenario can look for.</param>
/// <param name="Rows">How many expenses were written, deleted ones included.</param>
internal sealed record TimingDataSummary(string SearchName, int Rows);

/// <summary>A small repeatable number sequence (xorshift32), so every run builds the same data. It is test data, never a secret.</summary>
internal sealed class Sequence(uint seed)
{
    private uint _state = seed == 0 ? 1 : seed;

    /// <summary>Returns the next number from 0 up to, not including, <paramref name="maxExclusive"/>.</summary>
    /// <param name="maxExclusive">The upper bound.</param>
    /// <returns>The number.</returns>
    public int Next(int maxExclusive)
    {
        _state ^= _state << 13;
        _state ^= _state >> 17;
        _state ^= _state << 5;
        return (int)(_state % (uint)maxExclusive);
    }

    /// <summary>Returns the next number from <paramref name="minInclusive"/> up to, not including, <paramref name="maxExclusive"/>.</summary>
    /// <param name="minInclusive">The lower bound.</param>
    /// <param name="maxExclusive">The upper bound.</param>
    /// <returns>The number.</returns>
    public int Next(int minInclusive, int maxExclusive) => minInclusive + Next(maxExclusive - minInclusive);
}
