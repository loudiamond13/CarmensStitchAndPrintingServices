using Csps.Application.ExpenseCategories;
using Csps.Application.Ports;
using NSubstitute;

namespace Csps.Application.UnitTests.ExpenseCategories;

/// <summary>D-11, D-15: the category list keeps the store's order and turns the retired flag into a status word.</summary>
public sealed class ListExpenseCategoriesHandlerTests
{
    [Fact]
    public async Task EachCategoryKeepsItsFieldsAndGetsAnActiveOrRetiredStatus()
    {
        var rent = new ExpenseCategoryView(Guid.NewGuid(), "Rent", "accent", Retired: false, IsOthers: false);
        var old = new ExpenseCategoryView(Guid.NewGuid(), "Old", "neutral", Retired: true, IsOthers: false);
        var others = new ExpenseCategoryView(Guid.NewGuid(), "Others", "neutral", Retired: false, IsOthers: true);
        var store = Substitute.For<IExpenseCategories>();
        store.ListAsync(TestContext.Current.CancellationToken).Returns([rent, old, others]);

        var result = await new ListExpenseCategoriesHandler(store).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(
        [
            new ExpenseCategoryListItem(rent.Id, "Rent", "accent", "active", false),
            new ExpenseCategoryListItem(old.Id, "Old", "neutral", "retired", false),
            new ExpenseCategoryListItem(others.Id, "Others", "neutral", "active", true),
        ]);
    }

    [Fact]
    public async Task NoCategoriesIsAnEmptyList()
    {
        var store = Substitute.For<IExpenseCategories>();
        store.ListAsync(TestContext.Current.CancellationToken).Returns([]);

        var result = await new ListExpenseCategoriesHandler(store).HandleAsync(TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBeEmpty();
    }
}
