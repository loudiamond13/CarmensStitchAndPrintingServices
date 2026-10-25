using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Infrastructure.IntegrationTests.Expenses;

/// <summary>
/// D-10, D-30, OQ-10, T-06-41, T-06-42: the database is the backstop for the two category races. An expense that appears after the
/// delete was decided makes the foreign key refuse the delete, and two categories with one normalized name make the unique index
/// refuse the second. Each becomes a typed exception and the failed row leaves the context.
/// </summary>
public sealed class ExpenseCategoryStoreTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);
    private static readonly DateOnly Day = new(2026, 10, 24);

    [Fact]
    public async Task AnExpenseAddedAfterTheCategoryWasLoadedMakesTheDeleteThrowInUseAndDetachesTheRow()
    {
        var payer = await NewUserAsync();
        var category = await SaveCategoryAsync($"Race {Guid.NewGuid():N}"[..20]);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);
        var loaded = (await store.FindAsync(category.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        (await store.CountExpensesAsync(category.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
        await AddExpenseAsync(category.Id, payer, deleted: false);

        store.Remove(loaded);
        var unit = new CspsUnitOfWork(context);
        await Should.ThrowAsync<CategoryInUseException>(() => unit.SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
        await using var check = database.CreateContext();
        (await check.ExpenseCategories.CountAsync(row => row.Id == category.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task ASoftDeletedExpenseStillCountsAndStillBlocksTheDelete()
    {
        var payer = await NewUserAsync();
        var category = await SaveCategoryAsync($"Soft {Guid.NewGuid():N}"[..20]);
        await AddExpenseAsync(category.Id, payer, deleted: true);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);

        (await store.CountExpensesAsync(category.Id, TestContext.Current.CancellationToken)).ShouldBe(1);
        var loaded = (await store.FindAsync(category.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        store.Remove(loaded);

        await Should.ThrowAsync<CategoryInUseException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AnExpenseSavedInACategoryThatWasJustDeletedThrowsDeletedAndDetachesTheRow()
    {
        var payer = await NewUserAsync();
        var category = await SaveCategoryAsync($"Gone {Guid.NewGuid():N}"[..20]);
        await DeleteCategoryAsync(category.Id);
        await using var context = database.CreateContext();
        context.CompanyExpenses.Add(CompanyExpense.Create(Day, category.Id, "Detergent", 120.00m, payer, null, Day, Now).Value);

        await Should.ThrowAsync<CategoryDeletedException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
    }

    [Fact]
    public async Task AnExpenseMovedToACategoryThatWasJustDeletedThrowsDeleted()
    {
        var payer = await NewUserAsync();
        var home = await SaveCategoryAsync($"Home {Guid.NewGuid():N}"[..20]);
        var target = await SaveCategoryAsync($"Away {Guid.NewGuid():N}"[..20]);
        await AddExpenseAsync(home.Id, payer, deleted: false);
        await using var context = database.CreateContext();
        var expense = await context.CompanyExpenses.SingleAsync(row => row.CategoryId == home.Id, TestContext.Current.CancellationToken);
        await DeleteCategoryAsync(target.Id);
        expense.Update(Day, target.Id, expense.Description, expense.Amount, payer, null, Day).IsSuccess.ShouldBeTrue();

        await Should.ThrowAsync<CategoryDeletedException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ACategoryNoExpenseUsesIsRemoved()
    {
        var category = await SaveCategoryAsync($"Free {Guid.NewGuid():N}"[..20]);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);
        store.Remove((await store.FindAsync(category.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull());

        var saved = await new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken);

        saved.ShouldBe(1);
        await using var check = database.CreateContext();
        (await check.ExpenseCategories.CountAsync(row => row.Id == category.Id, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task ASecondCategoryWithTheSameNormalizedNameThrowsNameTakenAndDetachesTheRow()
    {
        var name = $"Twin {Guid.NewGuid():N}"[..20];
        await SaveCategoryAsync(name);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);
        store.Add(ExpenseCategory.Create(name.ToUpperInvariant(), CategoryTones.Info, Now).Value);

        await Should.ThrowAsync<CategoryNameTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries().ShouldBeEmpty();
    }

    [Fact]
    public async Task ARenameOntoAnotherCategorysNameThrowsNameTaken()
    {
        var first = $"First {Guid.NewGuid():N}"[..20];
        var second = $"Second {Guid.NewGuid():N}"[..20];
        await SaveCategoryAsync(first);
        var other = await SaveCategoryAsync(second);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);
        var loaded = (await store.FindAsync(other.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        loaded.Rename(first.ToLowerInvariant()).IsSuccess.ShouldBeTrue();

        await Should.ThrowAsync<CategoryNameTakenException>(() => new CspsUnitOfWork(context).SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TheNameLookupIgnoresLetterCaseCountsRetiredCategoriesAndCanLeaveOneOut()
    {
        var name = $"Look {Guid.NewGuid():N}"[..20];
        var category = await SaveCategoryAsync(name, retired: true);
        await using var context = database.CreateContext();
        var store = new ExpenseCategoryStore(context);
        var normalized = ExpenseCategory.Normalize(name.ToLowerInvariant());

        (await store.NameTakenAsync(normalized, null, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await store.NameTakenAsync(normalized, category.Id, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await store.NameTakenAsync("NO SUCH CATEGORY", null, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    private async Task<ExpenseCategory> SaveCategoryAsync(string name, bool retired = false)
    {
        var category = ExpenseCategory.Create(name, CategoryTones.Info, Now).Value;
        if (retired)
        {
            category.Retire(Now);
        }

        await using var context = database.CreateContext();
        context.ExpenseCategories.Add(category);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return category;
    }

    private async Task DeleteCategoryAsync(Guid id)
    {
        await using var context = database.CreateContext();
        context.ExpenseCategories.Remove(await context.ExpenseCategories.SingleAsync(row => row.Id == id, TestContext.Current.CancellationToken));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task AddExpenseAsync(Guid categoryId, Guid payer, bool deleted)
    {
        var expense = CompanyExpense.Create(Day, categoryId, "Detergent", 120.00m, payer, null, Day, Now).Value;
        await using var context = database.CreateContext();
        context.CompanyExpenses.Add(expense);
        var entry = context.Entry(expense);
        entry.Property(row => row.CreatedById).CurrentValue = payer;
        if (deleted)
        {
            entry.Property(row => row.DeletedAtUtc).CurrentValue = Now.AddMinutes(1);
            entry.Property(row => row.DeletedById).CurrentValue = payer;
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> NewUserAsync()
    {
        await using var context = database.CreateContext();
        var email = $"category.{Guid.NewGuid():N}@example.com";
        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(),
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            FirstName = "Paolo",
            LastName = "Reyes",
        };
        context.Users.Add(user);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return user.Id;
    }
}
