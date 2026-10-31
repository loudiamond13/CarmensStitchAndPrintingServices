using Csps.Application.ExpenseCategories;
using Csps.Application.Ports;
using Csps.Application.Users;
using NSubstitute;

namespace Csps.Application.UnitTests.ExpenseCategories;

/// <summary>CEXP-02, D-10, D-11: a Manager reads one category with its status, usage count, who recorded and last changed it, and its version.</summary>
public sealed class GetExpenseCategoryHandlerTests
{
    private static readonly DateTimeOffset Recorded = new(2026, 10, 24, 20, 30, 0, TimeSpan.Zero);

    [Fact]
    public async Task AnActiveCategoryIsReadWithItsFieldsAndAnEncodedVersion()
    {
        var id = Guid.NewGuid();
        var recorder = new ActorRef(Guid.NewGuid(), "Paolo Reyes", false);
        var changer = new ActorRef(Guid.NewGuid(), "Mina Mercado", true);
        var store = Substitute.For<IExpenseCategories>();
        store.GetDetailAsync(id, TestContext.Current.CancellationToken).Returns(
            new ExpenseCategoryDetailView(id, "Laundry", "info", Retired: false, IsOthers: false, ExpenseCount: 3, recorder, Recorded, changer, Recorded.AddDays(1), [0, 0, 0, 0, 0, 0, 0, 7]));

        var result = await new GetExpenseCategoryHandler(store).HandleAsync(id, TestContext.Current.CancellationToken);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ShouldBe(new ExpenseCategoryDetailResponse(
            id, "Laundry", "info", "active", IsOthers: false, ExpenseCount: 3, recorder, Recorded, changer, Recorded.AddDays(1), "AAAAAAAAAAc="));
    }

    [Fact]
    public async Task ARetiredCategoryReadsRetiredAndOthersReadsAsOthers()
    {
        var id = Guid.NewGuid();
        var store = Substitute.For<IExpenseCategories>();
        store.GetDetailAsync(id, TestContext.Current.CancellationToken).Returns(
            new ExpenseCategoryDetailView(id, "Others", "neutral", Retired: true, IsOthers: true, ExpenseCount: 0, null, Recorded, null, null, [0, 0, 0, 0, 0, 0, 0, 1]));

        var result = await new GetExpenseCategoryHandler(store).HandleAsync(id, TestContext.Current.CancellationToken);

        result.Value.Status.ShouldBe("retired");
        result.Value.IsOthers.ShouldBeTrue();
        result.Value.RecordedBy.ShouldBeNull();
        result.Value.LastChangedBy.ShouldBeNull();
        result.Value.LastChangedAt.ShouldBeNull();
    }

    [Fact]
    public async Task AnUnknownCategoryIsA404()
    {
        var store = Substitute.For<IExpenseCategories>();
        store.GetDetailAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((ExpenseCategoryDetailView?)null);

        var result = await new GetExpenseCategoryHandler(store).HandleAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Error.ShouldBe(ExpenseCategoryErrors.NotFound);
    }
}
