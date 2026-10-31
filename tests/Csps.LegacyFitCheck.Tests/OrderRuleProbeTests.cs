using System.Reflection;
using Csps.Domain.Identity;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Checks;
using Csps.LegacyFitCheck.Findings;

namespace Csps.LegacyFitCheck.Tests;

public sealed class OrderRuleProbeTests
{
    private static readonly DateOnly Today = new(2026, 10, 29);
    private static readonly DateTimeOffset Now = new(2026, 10, 29, 0, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly OrderDate = new(2025, 6, 10);

    [Theory]
    [InlineData(2000, 1, 1)]
    [InlineData(2025, 6, 10)]
    [InlineData(2026, 10, 29)]
    [InlineData(2031, 1, 1)]
    public void TheNeutralOrderPassesStrict(int year, int month, int day)
    {
        var date = NeutralOrder.DateFor(new DateOnly(year, month, day), Today);

        var result = Order.Import(NeutralOrder.Create(date), OrderImportRules.Strict, Now, Today);

        result.IsSuccess.ShouldBeTrue(result.IsFailure ? string.Join(';', result.Error.FieldErrors!.Keys) : string.Empty);
    }

    [Fact]
    public void TheFlagTableCoversEveryRule()
    {
        var properties = typeof(OrderImportRules)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Where(static property => property.PropertyType == typeof(bool))
            .ToList();
        properties.Count.ShouldBe(14);

        foreach (var property in properties)
        {
            var row = ProbeFlags.All.Where(item => item.Name == property.Name).ShouldHaveSingleItem();
            var changed = properties.Where(other => !Equals(other.GetValue(OrderImportRules.Default), other.GetValue(row.TurnOff(OrderImportRules.Default)))).ToList();
            changed.ShouldHaveSingleItem().Name.ShouldBe(property.Name);
        }

        ProbeFlags.All.Count.ShouldBe(properties.Count);
    }

    [Fact]
    public void DetailsFieldsAreJudgedSeparately()
    {
        var details = Valid().Details with { CustomerName = new string('a', 101), Notes = new string('b', 2001) };

        var findings = Probe(Valid() with { Details = details });

        Breaks(findings).ShouldBe(["customerName", "notes"], ignoreOrder: true);
    }

    [Fact]
    public void EachDetailsGroupReportsItsOwnBreakAndRelaxation()
    {
        var details = new OrderDetails("Sample club", new string('t', 101), "12ab", "not an email", new string('a', 301), OrderDate, OrderDate.AddDays(-1), null);

        var findings = Probe(Valid() with { Details = details, Number = string.Empty });

        Breaks(findings).ShouldBe(["teamName", "contactNumber", "email", "address", "dueDate", "number"], ignoreOrder: true);
    }

    [Fact]
    public void ARelaxationIsReportedFromTheGroupThatNeedsIt()
    {
        var snapshot = Valid() with
        {
            Number = "OLD-1",
            StatusHistory = [new ImportedStatusChange(OrderStatus.Pending, OrderStatus.Pending, null, Now)],
        };

        var relied = Relied(Probe(snapshot), ProbeScope.Details);

        relied.ShouldBe(["KeepLegacyNumber", "DueDateOptional", "ContactNumberOptional", "AllowAnyStatusHistory"], ignoreOrder: true);
    }

    [Fact]
    public void ABrokenChildKeepsItsRealPlaceInThePath()
    {
        var snapshot = Valid() with
        {
            Items = [Valid().Items[0], Valid().Items[0] with { UnitPrice = 12.345m }],
            Payments = [Payment(10m), Payment(10m), Payment(0m)],
        };

        Breaks(Probe(snapshot)).ShouldBe(["items[1].unitPrice", "payments[2].amount"], ignoreOrder: true);
    }

    [Fact]
    public void ABigAmountOrAFutureDateReliesOnItsChildRelaxationOnce()
    {
        var snapshot = Valid() with
        {
            Payments = [Payment(2_000_000m), Payment(10m) with { PaymentDate = Today.AddDays(3) }],
        };

        var relied = Relied(Probe(snapshot), ProbeScope.Child);

        relied.ShouldBe(["IgnoreAmountCaps", "AllowFutureDates"], ignoreOrder: true);
        Probe(snapshot).Count(static finding => finding.RuleKey == "IgnoreAmountCaps").ShouldBe(1);
    }

    [Fact]
    public void ARefundIsProbedLikeAnyOtherChild()
    {
        var snapshot = Valid() with { Refunds = [new NewOrderRefund(OrderDate, 0m, "Sample", LegacyHolder.Id)] };

        Breaks(Probe(snapshot)).ShouldBe(["refunds[0].amount"]);
    }

    [Fact]
    public void PaymentsAboveTheTotalReliesOnAllowOverpaid()
    {
        var snapshot = Valid() with { Payments = [Payment(250m)] };

        Relied(Probe(snapshot), ProbeScope.Figures).ShouldBe(["AllowOverpaid"]);
    }

    [Fact]
    public void ACompletedOrderWithABalanceReliesOnAllowCompletedWithBalance()
    {
        var snapshot = Valid() with { Status = OrderStatus.Completed, Payments = [Payment(40m)] };

        Relied(Probe(snapshot), ProbeScope.Figures).ShouldBe(["AllowCompletedWithBalance"]);
    }

    [Fact]
    public void DiscountsAboveTheSubtotalRelyOnAllowDiscountAboveSubtotal()
    {
        var snapshot = Valid() with { Discounts = [new NewOrderDiscount(DiscountKind.Fixed, 250m, "Sample")] };

        // A total below zero also leaves a balance below zero, so the overpaid relaxation shows too.
        Relied(Probe(snapshot), ProbeScope.Figures).ShouldBe(["AllowDiscountAboveSubtotal", "AllowOverpaid"], ignoreOrder: true);
    }

    [Fact]
    public void NoItemsRelyOnAllowNoItems()
    {
        var snapshot = Valid() with { Items = [] };

        Relied(Probe(snapshot), ProbeScope.Figures).ShouldBe(["AllowNoItems"]);
    }

    [Fact]
    public void MoreThanTheChildCapRelyOnIgnoreChildCaps()
    {
        var snapshot = Valid() with { Items = [.. Enumerable.Repeat(Valid().Items[0], 101)] };

        Relied(Probe(snapshot), ProbeScope.Figures).ShouldBe(["IgnoreChildCaps"]);
    }

    [Fact]
    public void AStructuralBreakMakesFiguresNotJudged()
    {
        var snapshot = Valid() with { Payments = [Payment(0m)], Status = OrderStatus.Completed };

        var findings = Probe(snapshot);

        findings.Where(static finding => finding.Type == FindingType.NotJudged).ShouldHaveSingleItem().RuleKey.ShouldBe("figures.not-judged");
        Relied(findings, ProbeScope.Figures).ShouldBeEmpty();
    }

    [Fact]
    public void AnOrderThatPassesEverythingNeedsOnlyTheDetailsRelaxationsItUses()
    {
        var findings = Probe(Valid());

        Breaks(findings).ShouldBeEmpty();
        findings.Where(static finding => finding.Type == FindingType.NotJudged).ShouldBeEmpty();
        Relied(findings, ProbeScope.Details).ShouldBe(["DueDateOptional", "ContactNumberOptional"], ignoreOrder: true);
    }

    [Fact]
    public void OneFieldShowsOnlyItsFirstMessage()
    {
        var details = Valid().Details with { ContactNumber = new string('x', 31) };

        var found = Probe(Valid() with { Details = details }).Where(static finding => finding.Type == FindingType.RuleBreak).ShouldHaveSingleItem();

        found.Path.ShouldBe("contactNumber");
        found.Message.ShouldBe(OrderRules.ContactNumberTooLong);
    }

    [Fact]
    public void ABreakRuleKeyHoldsTheFieldAndTheMessageButNeverAValue()
    {
        var snapshot = Valid() with { Items = [Valid().Items[0], Valid().Items[0] with { UnitPrice = 12.345m }] };

        var found = Probe(snapshot).Where(static finding => finding.Type == FindingType.RuleBreak).ShouldHaveSingleItem();

        found.RuleKey.ShouldBe($"items[].unitPrice: {OrderRules.MoneyDecimals}");
        found.Detail.ShouldBeNull();
    }

    private static OrderImportSnapshot Valid() =>
        new(
            "ORD-2025-0001",
            new OrderDetails("Sample club", null, null, null, null, OrderDate, null, null),
            OrderStatus.Pending,
            [new NewOrderItem(OrderListSeed.ProductTypes[0].Id, "Sample shirt", null, 2, 100m)]);

    private static NewOrderPayment Payment(decimal amount) =>
        new(OrderDate, amount, OrderListSeed.PaymentMethods[0].Id, null, null, LegacyHolder.Id);

    private static IReadOnlyList<Finding> Probe(OrderImportSnapshot snapshot) => OrderRuleProbe.Probe("Orders:1", snapshot, Now, Today);

    private static IEnumerable<string> Breaks(IEnumerable<Finding> findings) =>
        findings.Where(static finding => finding.Type == FindingType.RuleBreak).Select(static finding => finding.Path!);

    private static IEnumerable<string> Relied(IEnumerable<Finding> findings, ProbeScope scope)
    {
        var names = ProbeFlags.For(scope).Select(static flag => flag.Name).ToList();
        return findings.Where(static finding => finding.Type == FindingType.ReliesOnRelaxation).Select(static finding => finding.RuleKey).Where(names.Contains).Distinct();
    }
}
