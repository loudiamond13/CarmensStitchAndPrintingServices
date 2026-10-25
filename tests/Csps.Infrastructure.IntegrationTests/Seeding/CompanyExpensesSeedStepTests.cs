using Csps.Application.Security;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Seeding;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Seeding;

/// <summary>CEXP-01, PERF-04: the dev seed adds demo company expenses for the local list, paid by real local staff.</summary>
public sealed class CompanyExpensesSeedStepTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    // 12:00 on 2026-10-25 in Manila.
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 4, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 10, 25);

    [Fact]
    public async Task AddsSixtyPastAndFourUpcomingExpensesPaidByTheActiveStaff()
    {
        await database.ResetAsync();
        var staff = new List<Guid> { await AddUserAsync(Roles.Admin, "fake-hash", true), await AddUserAsync(Roles.Manager, "fake-hash", true) };
        await AddUserAsync(Roles.Manager, null, true);
        await AddUserAsync(Roles.Admin, "fake-hash", false);

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeTrue();
        var rows = await ReadExpensesAsync();
        rows.Count.ShouldBe(64);
        rows.Count(row => row.ExpenseDate <= Today).ShouldBe(60);
        rows.Where(row => row.ExpenseDate <= Today).ShouldAllBe(row => row.ExpenseDate >= new DateOnly(2026, 8, 26));
        rows.Where(row => row.ExpenseDate > Today).Count().ShouldBe(4);
        rows.Where(row => row.ExpenseDate > Today).ShouldAllBe(row => row.ExpenseDate <= new DateOnly(2026, 11, 24));
        rows.ShouldAllBe(row => staff.Contains(row.PaidByUserId));
        rows.ShouldAllBe(row => row.CreatedById != null && staff.Contains(row.CreatedById.Value));
        rows.ShouldAllBe(row => row.CreatedAtUtc == Now);
        rows.ShouldAllBe(row => !row.IsDeleted);
        rows.ShouldAllBe(row => row.Amount >= 150.00m && row.Amount <= 25_000.00m);
        rows.ShouldAllBe(row => row.Description.Length > 0 && row.Notes == null);
    }

    [Fact]
    public async Task UsesOnlySeededCategoriesAndAllTenOfThem()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Manager, "fake-hash", true);

        await RunAsync();

        var used = (await ReadExpensesAsync()).Select(row => row.CategoryId).Distinct().Order().ToList();
        used.ShouldBe([.. ExpenseCategorySeed.Rows.Select(row => row.Id).Order()]);
    }

    [Fact]
    public async Task ASecondRunAddsNothing()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Manager, "fake-hash", true);
        await RunAsync();

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeFalse();
        (await ReadExpensesAsync()).Count.ShouldBe(64);
    }

    [Fact]
    public async Task AnExistingExpenseKeepsTheSeedOut()
    {
        await database.ResetAsync();
        var payer = await AddUserAsync(Roles.Manager, "fake-hash", true);
        await AddExpenseAsync(payer);

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeFalse();
        (await ReadExpensesAsync()).Count.ShouldBe(1);
    }

    [Fact]
    public async Task NoActiveStaffWithAPasswordSkipsTheSeedAndCreatesNoAccounts()
    {
        await database.ResetAsync();
        await AddUserAsync(Roles.Manager, null, true);
        await AddUserAsync(Roles.Admin, "fake-hash", false);

        var results = await RunAsync();

        results.ShouldHaveSingleItem().Changed.ShouldBeFalse();
        (await ReadExpensesAsync()).ShouldBeEmpty();
        var context = database.CreateContext();
        await using (context)
        {
            (await context.Users.CountAsync(TestContext.Current.CancellationToken)).ShouldBe(2);
        }
    }

    [Fact]
    public void TheStepIsInTheDevSeedWithItsOwnOrder()
    {
        DevSeedSteps.All.Select(step => step.Order).ShouldBeUnique();
        var step = DevSeedSteps.All.OfType<CompanyExpensesSeedStep>().ShouldHaveSingleItem();
        step.Order.ShouldBe(300);
        step.Name.ShouldBe("CompanyExpenses");
    }

    private async Task<IReadOnlyList<SeedStepResult>> RunAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await new DevSeeder([new CompanyExpensesSeedStep()], new FakeTimeProvider(Now))
                .RunAsync(context, TestContext.Current.CancellationToken);
        }
    }

    private async Task<Guid> AddUserAsync(string role, string? passwordHash, bool active)
    {
        var context = database.CreateContext();
        await using (context)
        {
            var email = $"seed.{Guid.NewGuid():N}@example.com";
            var user = new ApplicationUser
            {
                Id = Guid.NewGuid(),
                UserName = email,
                NormalizedUserName = email.ToUpperInvariant(),
                Email = email,
                NormalizedEmail = email.ToUpperInvariant(),
                FirstName = "Paolo",
                LastName = "Reyes",
                PasswordHash = passwordHash,
                IsActive = active,
            };
            context.Users.Add(user);
            var roleId = await context.Roles.Where(row => row.Name == role).Select(row => row.Id).SingleAsync(TestContext.Current.CancellationToken);
            context.UserRoles.Add(new IdentityUserRole<Guid> { UserId = user.Id, RoleId = roleId });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            return user.Id;
        }
    }

    private async Task AddExpenseAsync(Guid payer)
    {
        var context = database.CreateContext();
        await using (context)
        {
            var created = CompanyExpense.Create(Today, ExpenseCategorySeed.OthersId, "Thread", 120.00m, payer, null, Today, Now);
            context.CompanyExpenses.Add(created.Value);
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task<List<CompanyExpense>> ReadExpensesAsync()
    {
        var context = database.CreateContext();
        await using (context)
        {
            return await context.CompanyExpenses.AsNoTracking().ToListAsync(TestContext.Current.CancellationToken);
        }
    }
}
