using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;

namespace Csps.Domain.UnitTests.OrderLists;

/// <summary>D-16, D-17, D-18, D-19: the seventeen starting entries of the three order lists, their tones and their stable ids.</summary>
public sealed class OrderListSeedTests
{
    private static readonly (string Name, string Tone)[] ExpectedProductTypes =
    [
        ("Basketball Jersey", "accent"),
        ("Volleyball Jersey", "info"),
        ("Moto Riding Jersey", "warning"),
        ("Long Sleeves", "mockup"),
        ("Polo Shirt", "success"),
        ("Custom Design", "neutral"),
    ];

    private static readonly (string Name, string Tone)[] ExpectedPaymentMethods =
    [
        ("Cash", "neutral"),
        ("GCash", "info"),
        ("Maya", "success"),
        ("Bank Transfer", "mockup"),
        ("Cheque", "warning"),
    ];

    private static readonly (string Name, string Tone)[] ExpectedOrderExpenseCategories =
    [
        ("Fabric", "info"),
        ("Ink & paper", "accent"),
        ("Outsourcing", "mockup"),
        ("Labor", "warning"),
        ("Delivery", "success"),
        ("Others", "neutral"),
    ];

    [Fact]
    public void ProductTypesAreTheSixWithTheirTones()
    {
        OrderListSeed.ProductTypes.Select(row => (row.Name, row.Tone)).ShouldBe(ExpectedProductTypes);
    }

    [Fact]
    public void PaymentMethodsAreTheFiveWithTheirTones()
    {
        OrderListSeed.PaymentMethods.Select(row => (row.Name, row.Tone)).ShouldBe(ExpectedPaymentMethods);
    }

    [Fact]
    public void OrderExpenseCategoriesAreTheSixWithTheirTones()
    {
        OrderListSeed.OrderExpenseCategories.Select(row => (row.Name, row.Tone)).ShouldBe(ExpectedOrderExpenseCategories);
    }

    [Fact]
    public void EveryIdIsDistinctAcrossAllThreeListsAndNotEmpty()
    {
        var ids = AllRows().Select(row => row.Id).ToList();

        ids.Count.ShouldBe(17);
        ids.Distinct().Count().ShouldBe(17);
        ids.ShouldAllBe(id => id != Guid.Empty);
    }

    [Fact]
    public void EveryIdIsAVersionSevenGuid()
    {
        AllRows().ShouldAllBe(row => row.Id.Version == 7);
    }

    [Fact]
    public void EveryToneIsOneTheDatabaseAccepts()
    {
        AllRows().ShouldAllBe(row => CategoryTones.IsValid(row.Tone));
    }

    [Theory]
    [InlineData(OrderListKind.ProductType)]
    [InlineData(OrderListKind.PaymentMethod)]
    [InlineData(OrderListKind.OrderExpenseCategory)]
    public void NamesAreUniqueWithinAListAfterNormalizing(OrderListKind kind)
    {
        var rows = OrderListSeed.Rows(kind);

        rows.Select(row => OrderListEntry.Normalize(row.Name)).Distinct().Count().ShouldBe(rows.Count);
    }

    [Fact]
    public void TheStampIsTheLiteralSeedInstant()
    {
        OrderListSeed.SeededAtUtc.ShouldBe(new DateTimeOffset(2026, 10, 28, 0, 0, 0, TimeSpan.Zero));
    }

    [Fact]
    public void OthersIdIsTheOrderExpenseOthersRow()
    {
        OrderListSeed.OrderExpenseCategories.Single(row => row.Name == "Others").Id.ShouldBe(OrderListSeed.OrderExpenseOthersId);
        OrderExpenseCategory.OthersId.ShouldBe(OrderListSeed.OrderExpenseOthersId);
    }

    [Fact]
    public void RowsReturnsTheListOfEachKind()
    {
        OrderListSeed.Rows(OrderListKind.ProductType).ShouldBe(OrderListSeed.ProductTypes);
        OrderListSeed.Rows(OrderListKind.PaymentMethod).ShouldBe(OrderListSeed.PaymentMethods);
        OrderListSeed.Rows(OrderListKind.OrderExpenseCategory).ShouldBe(OrderListSeed.OrderExpenseCategories);
    }

    [Fact]
    public void RowsRefusesAnUnknownKind()
    {
        Should.Throw<ArgumentOutOfRangeException>(() => OrderListSeed.Rows((OrderListKind)0));
    }

    private static IEnumerable<OrderListSeedRow> AllRows() =>
        OrderListSeed.ProductTypes.Concat(OrderListSeed.PaymentMethods).Concat(OrderListSeed.OrderExpenseCategories);
}
