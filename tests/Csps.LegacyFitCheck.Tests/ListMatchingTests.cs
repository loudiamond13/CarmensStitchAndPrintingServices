using Csps.Domain.OrderLists;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Tests;

public sealed class ListMatchingTests
{
    private static readonly DateTime SomeDay = new(2025, 3, 4, 2, 30, 0, DateTimeKind.Unspecified);

    [Theory]
    [InlineData("polo shirt")]
    [InlineData(" Polo Shirt ")]
    public void ANameMatchesTheSeededProductTypeIgnoringCaseAndSpaces(string legacyName)
    {
        var lists = ListMatching.ForProductTypes([legacyName]);

        var match = lists.ForProductType(legacyName);
        match.TrialOnly.ShouldBeFalse();
        match.Id.ShouldBe(OrderListSeed.ProductTypes.Single(static row => row.Name == "Polo Shirt").Id);
        lists.TrialEntries.ShouldNotContain(static entry => entry.Kind == OrderListKind.ProductType);
    }

    [Fact]
    public void AnUnmatchedNameBecomesOneTrialOnlyEntryEvenWhenSpelledTwoWays()
    {
        var lists = ListMatching.ForProductTypes(["Fixture Garments", " fixture garments "]);

        var entry = lists.TrialEntries.Where(static row => row.Kind == OrderListKind.ProductType).ShouldHaveSingleItem();
        entry.Name.ShouldBe("Fixture Garments");
        lists.ForProductType("Fixture Garments").Id.ShouldBe(entry.Id);
        lists.ForProductType(" fixture garments ").Id.ShouldBe(entry.Id);
        lists.ForProductType("Fixture Garments").TrialOnly.ShouldBeTrue();
    }

    [Fact]
    public void TwoDifferentUnmatchedNamesGiveTwoEntries()
    {
        var lists = ListMatching.ForProductTypes(["Fixture Garments", "Fixture Banners"]);

        var entries = lists.TrialEntries.Where(static row => row.Kind == OrderListKind.ProductType).ToList();
        entries.Count.ShouldBe(2);
        entries.Select(static row => row.Id).Distinct().Count().ShouldBe(2);
    }

    [Fact]
    public void EveryItemOfEveryOrderOfAnUnmatchedTypeSharesTheEntryAndIsReported()
    {
        var types = new Dictionary<int, string?> { [1] = "Fixture Garments" };
        var statuses = new Dictionary<int, string?> { [1] = "Open" };
        var lists = ListMatching.ForProductTypes(types.Values);

        var first = DraftMapping.MapOrder(Order(1), WithItems(1, 2), types, statuses, lists);
        var second = DraftMapping.MapOrder(Order(2), WithItems(3), types, statuses, lists);

        var ids = first.Snapshot!.Items.Concat(second.Snapshot!.Items).Select(static item => item.ProductTypeId).Distinct().ShouldHaveSingleItem();
        ids.ShouldBe(lists.TrialEntries.Single(static row => row.Kind == OrderListKind.ProductType).Id);
        var findings = first.Findings.Concat(second.Findings).Where(static finding => finding.Type == FindingType.UnmatchedList).ToList();
        findings.Count.ShouldBe(3);
        findings.ShouldAllBe(static finding => finding.RuleKey == "list.product-type" && finding.ListValue == "Fixture Garments" && finding.Kind == RecordKind.OrderItem);
    }

    [Fact]
    public void ANameOverFortyCharactersIsCannotMapWithNoEntryAndTheOrderIsNotImported()
    {
        var longName = new string('x', 41);
        var types = new Dictionary<int, string?> { [1] = longName };
        var statuses = new Dictionary<int, string?> { [1] = "Open" };
        var lists = ListMatching.ForProductTypes(types.Values);

        var mapped = DraftMapping.MapOrder(Order(1), WithItems(1), types, statuses, lists);

        lists.TrialEntries.ShouldNotContain(static entry => entry.Kind == OrderListKind.ProductType);
        mapped.Snapshot.ShouldBeNull();
        var finding = mapped.Findings.Where(static row => row.RuleKey == "list.name-too-long").ShouldHaveSingleItem();
        finding.Type.ShouldBe(FindingType.CannotMap);
        finding.ListValue.ShouldBe(longName);
    }

    [Fact]
    public void ABlankNameIsCannotMapAndTheOrderIsNotImported()
    {
        var types = new Dictionary<int, string?> { [1] = "  " };
        var statuses = new Dictionary<int, string?> { [1] = "Open" };
        var lists = ListMatching.ForProductTypes(types.Values);

        var mapped = DraftMapping.MapOrder(Order(1), WithItems(1), types, statuses, lists);

        mapped.Snapshot.ShouldBeNull();
        mapped.Findings.Where(static row => row.RuleKey == "list.name-blank").ShouldHaveSingleItem().Type.ShouldBe(FindingType.CannotMap);
    }

    [Fact]
    public void PaymentsAlwaysGetTheOneUnknownLegacyMethod()
    {
        var lists = ListMatching.ForProductTypes([]);

        var method = lists.TrialEntries.Where(static row => row.Kind == OrderListKind.PaymentMethod).ShouldHaveSingleItem();
        method.Name.ShouldBe("Unknown (legacy)");
        method.Id.ShouldBe(ListMatches.UnknownPaymentMethodId);
        ListMatching.UnknownPaymentMethod.ShouldBe(method);
    }

    private static LegacyOrderRow Order(int id) =>
        new() { OrderId = id, OrderName = "Sample Club", OrderDate = SomeDay, IsDeleted = false, OrderTypeId = 1, StatusId = 1 };

    private static LegacyOrderParts WithItems(params int[] ids) =>
        new([.. ids.Select(static id => new LegacyOrderItemRow { OrderItemId = id, OrderId = 1, Description = "Sample item", Quantity = 1, Price = 10m })], [], [], []);
}
