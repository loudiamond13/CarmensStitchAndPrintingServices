using Csps.Application.Audit;
using Csps.Application.Users;
using Csps.Domain.Auditing;

namespace Csps.Application.UnitTests.Audit;

/// <summary>D-27, 05 D-40: the stored detail of expense and category entries becomes typed lines, and no free text of an expense gets through.</summary>
public sealed class AuditChangeLinesTests
{
    private static readonly Guid Ana = Guid.Parse("11111111-1111-4111-8111-111111111111");
    private static readonly Guid Bea = Guid.Parse("22222222-2222-4222-8222-222222222222");
    private static readonly Guid Supplies = Guid.Parse("33333333-3333-4333-8333-333333333333");
    private static readonly Guid Equipment = Guid.Parse("44444444-4444-4444-8444-444444444444");

    [Fact]
    public void AnEditGivesTheAmountLineTheTextFieldNamesAndThePayerForDoneTo()
    {
        var parsed = AuditChangeLines.For(AuditActions.CompanyExpenseChanged, $"amount=1200.00>1250.00;fields=description;payer={Ana:D}");

        parsed.Lines.ShouldBe([new ParsedAuditChange("amount", "1200.00", "1250.00"), new ParsedAuditChange("description", null, null)]);
        parsed.PayerId.ShouldBe(Ana);
        parsed.Snapshot.ShouldBeNull();
    }

    [Fact]
    public void AnEditOfDateCategoryAndBothTextFieldsKeepsTheStoredOrder()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.CompanyExpenseChanged,
            $"date=2026-10-05>2026-10-06;category={Supplies:D}>{Equipment:D};fields=description,notes;payer={Ana:D}");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("date", "2026-10-05", "2026-10-06"),
            new ParsedAuditChange("category", Supplies.ToString("D"), Equipment.ToString("D")),
            new ParsedAuditChange("description", null, null),
            new ParsedAuditChange("notes", null, null),
        ]);
    }

    [Fact]
    public void APayerChangeGivesOnePayerLineAndTheNewPayerForDoneTo()
    {
        var parsed = AuditChangeLines.For(AuditActions.CompanyExpensePayerChanged, $"payer={Ana:D}>{Bea:D}");

        parsed.Lines.ShouldBe([new ParsedAuditChange("payer", Ana.ToString("D"), Bea.ToString("D"))]);
        parsed.PayerId.ShouldBe(Bea);
    }

    [Theory]
    [InlineData(AuditActions.CompanyExpenseAdded)]
    [InlineData(AuditActions.CompanyExpenseDeleted)]
    [InlineData(AuditActions.CompanyExpenseRestored)]
    [InlineData(AuditActions.CompanyExpensePermanentlyDeleted)]
    public void ASnapshotCodeGivesTheSnapshotAndNoLines(string action)
    {
        var parsed = AuditChangeLines.For(action, $"date=2026-10-05;category={Supplies:D};amount=8642.35;payer={Ana:D}");

        parsed.Lines.ShouldBeEmpty();
        parsed.Snapshot.ShouldBe(new ParsedAuditSnapshot(new DateOnly(2026, 10, 5), Supplies, 8642.35m, Ana));
        parsed.PayerId.ShouldBe(Ana);
    }

    [Fact]
    public void ACategoryRenameDecodesBothNames()
    {
        var parsed = AuditChangeLines.For(AuditActions.ExpenseCategoryRenamed, "name=Tools%3BParts>Office%3EWare");

        parsed.Lines.ShouldBe([new ParsedAuditChange("name", "Tools;Parts", "Office>Ware")]);
        parsed.PayerId.ShouldBeNull();
    }

    [Fact]
    public void ARecolorGivesAToneLineAndAnAddedCategoryGivesItsNameAndTone()
    {
        AuditChangeLines.For(AuditActions.ExpenseCategoryRecolored, "tone=info>success").Lines
            .ShouldBe([new ParsedAuditChange("tone", "info", "success")]);
        AuditChangeLines.For(AuditActions.ExpenseCategoryAdded, "name=Fuel;tone=warning").Lines
            .ShouldBe([new ParsedAuditChange("name", null, "Fuel"), new ParsedAuditChange("tone", null, "warning")]);
    }

    [Theory]
    [InlineData(AuditActions.ExpenseCategoryRetired)]
    [InlineData(AuditActions.ExpenseCategoryReactivated)]
    [InlineData(AuditActions.ExpenseCategoryDeleted)]
    public void ARetireReactivateOrDeleteGivesTheNameOnly(string action)
    {
        AuditChangeLines.For(action, "name=Old%3Dstock").Lines.ShouldBe([new ParsedAuditChange("name", null, "Old=stock")]);
    }

    [Fact]
    public void AnUnknownKeyAnUnknownFieldAndAMalformedValueAreLeftOut()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.CompanyExpenseChanged,
            "secret=hunter2>x;amount=lots>some;date=soon>later;category=a>b;fields=description,shoe-size;payer=not-a-guid");

        parsed.Lines.ShouldBe([new ParsedAuditChange("description", null, null)]);
        parsed.PayerId.ShouldBeNull();
    }

    [Fact]
    public void ASnapshotWithABadDateOrAmountIsLeftOut()
    {
        AuditChangeLines.For(AuditActions.CompanyExpenseAdded, $"date=yesterday;category={Supplies:D};amount=5.00;payer={Ana:D}").Snapshot.ShouldBeNull();
        AuditChangeLines.For(AuditActions.CompanyExpenseAdded, $"date=2026-10-05;category={Supplies:D};amount=five;payer={Ana:D}").Snapshot.ShouldBeNull();
    }

    [Theory]
    [InlineData(AuditActions.UserRoleChanged, "role=admin>manager")]
    [InlineData(AuditActions.SignInFailed, "bad-password")]
    [InlineData(AuditActions.UserDetailsChanged, "fields=email")]
    public void AnotherActionGivesNothing(string action, string detail)
    {
        AuditChangeLines.For(action, detail).ShouldBe(ParsedAuditChanges.None);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void NoDetailGivesNothing(string? detail)
    {
        AuditChangeLines.For(AuditActions.CompanyExpenseChanged, detail).ShouldBe(ParsedAuditChanges.None);
    }

    [Fact]
    public void ResolveNamesTheCategoriesAndThePeopleAndLeavesAGoneCategoryNull()
    {
        var anaRef = new ActorRef(Ana, "Ana Reyes", false);
        var beaRef = new ActorRef(Bea, "Bea Navarro", true);
        var parsed = new ParsedAuditChanges(
            [
                new ParsedAuditChange("amount", "1200.00", "1250.00"),
                new ParsedAuditChange("category", Supplies.ToString("D"), Equipment.ToString("D")),
                new ParsedAuditChange("payer", Ana.ToString("D"), Bea.ToString("D")),
                new ParsedAuditChange("notes", null, null),
            ],
            new ParsedAuditSnapshot(new DateOnly(2026, 10, 5), Equipment, 8642.35m, Bea),
            Bea);
        var categories = new Dictionary<Guid, string> { [Supplies] = "Supplies" };

        var (lines, snapshot) = AuditChangeLines.Resolve(parsed, categories, id => id == Ana ? anaRef : id == Bea ? beaRef : null);

        lines.ShouldBe(
        [
            new AuditChangeLine("amount", "1200.00", "1250.00", null, null),
            new AuditChangeLine("category", "Supplies", null, null, null),
            new AuditChangeLine("payer", null, null, anaRef, beaRef),
            new AuditChangeLine("notes", null, null, null, null),
        ]);
        snapshot.ShouldBe(new AuditExpenseSnapshot(new DateOnly(2026, 10, 5), null, 8642.35m, beaRef));
    }

    [Fact]
    public void ResolveOfNothingIsEmpty()
    {
        var (lines, snapshot) = AuditChangeLines.Resolve(ParsedAuditChanges.None, new Dictionary<Guid, string>(), _ => null);

        lines.ShouldBeEmpty();
        snapshot.ShouldBeNull();
    }

    private static readonly Guid ItemId = Guid.Parse("55555555-5555-4555-8555-555555555555");

    [Theory]
    [InlineData(AuditActions.OrderStatusChanged, "status=ready>completed", "ready", "completed")]
    [InlineData(AuditActions.OrderReopened, "status=completed>ready", "completed", "ready")]
    [InlineData(AuditActions.OrderStatusChanged, "status=pending>production", "pending", "production")]
    public void AStatusMoveGivesOneStatusLine(string action, string detail, string from, string to)
    {
        AuditChangeLines.For(action, detail).Lines.ShouldBe([new ParsedAuditChange("status", from, to)]);
    }

    [Fact]
    public void ACreatedOrderGivesItsStatusAndDatesAndItsNumber()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.OrderCreated, "number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=2026-11-11;items=1;total=9750.00");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("status", null, "pending"),
            new ParsedAuditChange("orderDate", null, "2026-10-28"),
            new ParsedAuditChange("dueDate", null, "2026-11-11"),
        ]);
        parsed.OrderNumber.ShouldBe("ORD-2026-0001");
    }

    [Fact]
    public void ACreatedOrderWithNoDueDateGivesNoDueDateLine()
    {
        AuditChangeLines.For(AuditActions.OrderCreated, "number=ORD-2026-0001;status=pending;orderDate=2026-10-28;dueDate=;items=1;total=9750.00")
            .Lines.Select(static line => line.Field).ShouldBe(["status", "orderDate"]);
    }

    [Fact]
    public void AnOrderEditGivesTheDateChangesAndOnlyTheNamesOfTheCustomerFields()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.OrderChanged, "orderDate=2026-10-28>2026-10-29;dueDate=2026-11-11>2026-11-18;fields=customerName,teamName,contactNumber,email,address,notes");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("orderDate", "2026-10-28", "2026-10-29"),
            new ParsedAuditChange("dueDate", "2026-11-11", "2026-11-18"),
            new ParsedAuditChange("customerName", null, null),
            new ParsedAuditChange("teamName", null, null),
            new ParsedAuditChange("contactNumber", null, null),
            new ParsedAuditChange("email", null, null),
            new ParsedAuditChange("address", null, null),
            new ParsedAuditChange("notes", null, null),
        ]);
    }

    [Fact]
    public void AnImportedOrderThatGainsADueDateGivesANewDueDateWithNoOldOne()
    {
        AuditChangeLines.For(AuditActions.OrderChanged, "dueDate=>2026-11-18").Lines.ShouldBe([new ParsedAuditChange("dueDate", null, "2026-11-18")]);
    }

    [Fact]
    public void AnItemEditGivesTheChangedPairsAndTheTextFieldNamesButNotTheUnchangedValues()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.OrderItemChanged,
            $"item={ItemId:D};productType={Supplies:D}>{Equipment:D};quantity=15>20;unitPrice=650.00;fields=description,sizeVariant");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("productType", Supplies.ToString("D"), Equipment.ToString("D")),
            new ParsedAuditChange("quantity", "15", "20"),
            new ParsedAuditChange("description", null, null),
            new ParsedAuditChange("sizeVariant", null, null),
        ]);
    }

    [Theory]
    [InlineData(AuditActions.OrderItemAdded)]
    [InlineData(AuditActions.OrderItemRemoved)]
    public void AnAddedOrRemovedItemGivesItsProductTypeQuantityAndPrice(string action)
    {
        AuditChangeLines.For(action, $"item={ItemId:D};productType={Supplies:D};quantity=2;unitPrice=550.00").Lines.ShouldBe(
        [
            new ParsedAuditChange("productType", null, Supplies.ToString("D")),
            new ParsedAuditChange("quantity", null, "2"),
            new ParsedAuditChange("unitPrice", null, "550.00"),
        ]);
    }

    [Fact]
    public void ADiscountValueCarriesAPercentSignWhileTheKindIsPercentage()
    {
        AuditChangeLines.For(AuditActions.OrderDiscountChanged, $"discount={ItemId:D};kind=percentage;value=5.00>10.00;fields=reason").Lines.ShouldBe(
        [
            new ParsedAuditChange("value", "5.00%", "10.00%"),
            new ParsedAuditChange("reason", null, null),
        ]);
        AuditChangeLines.For(AuditActions.OrderDiscountChanged, $"discount={ItemId:D};kind=percentage>fixed;value=5.00>500.00").Lines.ShouldBe(
        [
            new ParsedAuditChange("kind", "percentage", "fixed"),
            new ParsedAuditChange("value", "5.00%", "500.00"),
        ]);
        AuditChangeLines.For(AuditActions.OrderDiscountChanged, $"discount={ItemId:D};kind=fixed;value=100.00>150.00").Lines.ShouldBe(
            [new ParsedAuditChange("value", "100.00", "150.00")]);
    }

    [Theory]
    [InlineData(AuditActions.OrderDiscountAdded)]
    [InlineData(AuditActions.OrderDiscountRemoved)]
    public void AnAddedOrRemovedDiscountGivesItsKindAndValue(string action)
    {
        AuditChangeLines.For(action, $"discount={ItemId:D};kind=percentage;value=5.00").Lines.ShouldBe(
        [
            new ParsedAuditChange("kind", null, "percentage"),
            new ParsedAuditChange("value", null, "5.00%"),
        ]);
    }

    [Fact]
    public void APaymentEditGivesTheChangedPairsAndTheReferenceAndNotesNamesButNotTheUnchangedReceiver()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.OrderPaymentChanged,
            $"payment={ItemId:D};date=2026-10-25;amount=10000.00>9000.00;method={Supplies:D}>{Equipment:D};receiver={Ana:D};fields=reference,notes");

        parsed.Lines.ShouldBe(
        [
            new ParsedAuditChange("amount", "10000.00", "9000.00"),
            new ParsedAuditChange("method", Supplies.ToString("D"), Equipment.ToString("D")),
            new ParsedAuditChange("reference", null, null),
            new ParsedAuditChange("notes", null, null),
        ]);
        parsed.PayerId.ShouldBeNull();
    }

    [Theory]
    [InlineData(AuditActions.OrderPaymentReceiverChanged, "payment", "receiver")]
    [InlineData(AuditActions.OrderRefundRefunderChanged, "refund", "refunder")]
    [InlineData(AuditActions.OrderExpensePayerChanged, "expense", "payer")]
    public void APersonChangeGivesOneLineWithBothPeople(string action, string child, string key)
    {
        AuditChangeLines.For(action, $"{child}={ItemId:D};{key}={Ana:D}>{Bea:D}").Lines
            .ShouldBe([new ParsedAuditChange(key, Ana.ToString("D"), Bea.ToString("D"))]);
    }

    [Fact]
    public void ARefundGivesItsDateAmountAndRefunderAndAReasonChangeOnlyTheName()
    {
        AuditChangeLines.For(AuditActions.OrderRefundAdded, $"refund={ItemId:D};date=2026-10-28;amount=12000.00;refunder={Ana:D}").Lines.ShouldBe(
        [
            new ParsedAuditChange("date", null, "2026-10-28"),
            new ParsedAuditChange("amount", null, "12000.00"),
            new ParsedAuditChange("refunder", null, Ana.ToString("D")),
        ]);
        AuditChangeLines.For(AuditActions.OrderRefundChanged, $"refund={ItemId:D};date=2026-10-28;amount=12000.00>9000.00;refunder={Ana:D};fields=reason").Lines.ShouldBe(
            [new ParsedAuditChange("amount", "12000.00", "9000.00"), new ParsedAuditChange("reason", null, null)]);
    }

    [Fact]
    public void AnOrderExpenseReadsItsCategoryAsAnOrderCategory()
    {
        AuditChangeLines.For(
            AuditActions.OrderExpenseChanged,
            $"expense={ItemId:D};date=2026-10-23;amount=3825.00>3000.00;category={Supplies:D}>{Equipment:D};payer={Ana:D};fields=description").Lines.ShouldBe(
        [
            new ParsedAuditChange("amount", "3825.00", "3000.00"),
            new ParsedAuditChange("orderCategory", Supplies.ToString("D"), Equipment.ToString("D")),
            new ParsedAuditChange("description", null, null),
        ]);
        AuditChangeLines.For(AuditActions.OrderExpenseAdded, $"expense={ItemId:D};date=2026-10-23;amount=3825.00;category={Supplies:D};payer={Ana:D}").Lines.Select(static line => line.Field)
            .ShouldBe(["date", "amount", "orderCategory", "payer"]);
    }

    [Theory]
    [InlineData(AuditActions.OrderDeleted)]
    [InlineData(AuditActions.OrderRestored)]
    [InlineData(AuditActions.OrderPermanentlyDeleted)]
    public void ADeletedRestoredOrPermanentlyDeletedOrderGivesAnOrderSnapshotAndNoLines(string action)
    {
        var parsed = AuditChangeLines.For(
            action, "number=ORD-2026-0148;status=cancelled;subtotal=22450.00;discount=1122.50;total=21327.50;paid=12000.00;refunded=0.00;balance=9327.50;expenses=6065.00;receivers=;payers=;refunders=");

        parsed.Lines.ShouldBeEmpty();
        parsed.OrderSnapshot.ShouldBe(new AuditOrderSnapshot("ORD-2026-0148", "cancelled", 21327.50m, 12000.00m, 9327.50m));
        parsed.OrderNumber.ShouldBe("ORD-2026-0148");
    }

    [Theory]
    [InlineData("number=not-a-number;status=pending;total=1.00;paid=0.00;balance=1.00")]
    [InlineData("number=ORD-2026-0148;status=bogus;total=1.00;paid=0.00;balance=1.00")]
    [InlineData("number=ORD-2026-0148;status=pending;total=lots;paid=0.00;balance=1.00")]
    [InlineData("number=ORD-2026-0148;status=pending;total=1.00;paid=0.00")]
    public void AnOrderSnapshotThatDoesNotHaveTheWritersShapeIsLeftOut(string detail)
    {
        AuditChangeLines.For(AuditActions.OrderDeleted, detail).OrderSnapshot.ShouldBeNull();
    }

    [Theory]
    [InlineData(AuditActions.ProductTypeRenamed, "name=Polo>Polo Shirt", "name", "Polo", "Polo Shirt")]
    [InlineData(AuditActions.PaymentMethodRecolored, "tone=info>success", "tone", "info", "success")]
    [InlineData(AuditActions.OrderExpenseCategoryAdded, "name=Fabric%3BMesh;tone=neutral", "name", null, "Fabric;Mesh")]
    [InlineData(AuditActions.ProductTypeRetired, "name=Banner", "name", null, "Banner")]
    [InlineData(AuditActions.PaymentMethodReactivated, "name=Maya", "name", null, "Maya")]
    [InlineData(AuditActions.OrderExpenseCategoryDeleted, "name=Labor", "name", null, "Labor")]
    public void AListEntryEventGivesItsNameAndToneLines(string action, string detail, string field, string? from, string to)
    {
        AuditChangeLines.For(action, detail).Lines.ShouldContain(new ParsedAuditChange(field, from, to));
    }

    [Fact]
    public void AnUnknownKeyAndAMalformedOrderValueAreLeftOutAndNeverThrownOn()
    {
        var parsed = AuditChangeLines.For(
            AuditActions.OrderItemChanged,
            "secret=hunter2>x;quantity=lots>some;unitPrice=cheap>dear;productType=a>b;orderDate=soon>later;status=bogus>nope;kind=huge>tiny;method=a>b;receiver=not-a-guid>x;fields=shoe-size,customerSecret");

        parsed.ShouldBe(ParsedAuditChanges.None);
        AuditChangeLines.For(AuditActions.OrderChanged, "orderDate=soon>later;fields=").ShouldBe(ParsedAuditChanges.None);
    }

    [Fact]
    public void ResolveNamesTheListEntriesAndPeopleOfAnOrderEntryAndLeavesAGoneEntryNull()
    {
        var anaRef = new ActorRef(Ana, "Ana Reyes", false);
        var beaRef = new ActorRef(Bea, "Bea Navarro", true);
        var parsed = new ParsedAuditChanges(
            [
                new ParsedAuditChange("productType", Supplies.ToString("D"), Equipment.ToString("D")),
                new ParsedAuditChange("method", null, Supplies.ToString("D")),
                new ParsedAuditChange("orderCategory", Supplies.ToString("D"), Equipment.ToString("D")),
                new ParsedAuditChange("receiver", Ana.ToString("D"), Bea.ToString("D")),
                new ParsedAuditChange("refunder", null, Ana.ToString("D")),
                new ParsedAuditChange("quantity", "15", "20"),
            ],
            null,
            null);
        var lists = new AuditListNames(
            new Dictionary<Guid, string> { [Supplies] = "Polo Shirt" },
            new Dictionary<Guid, string> { [Supplies] = "GCash" },
            new Dictionary<Guid, string> { [Equipment] = "Fabric" });

        var (lines, _) = AuditChangeLines.Resolve(parsed, new Dictionary<Guid, string>(), id => id == Ana ? anaRef : id == Bea ? beaRef : null, lists);

        lines.ShouldBe(
        [
            new AuditChangeLine("productType", "Polo Shirt", null, null, null),
            new AuditChangeLine("method", null, "GCash", null, null),
            new AuditChangeLine("category", null, "Fabric", null, null),
            new AuditChangeLine("receiver", null, null, anaRef, beaRef),
            new AuditChangeLine("refunder", null, null, null, anaRef),
            new AuditChangeLine("quantity", "15", "20", null, null),
        ]);
        parsed.ProductTypeIds().ShouldBe([Supplies, Equipment]);
        parsed.PaymentMethodIds().ShouldBe([Supplies]);
        parsed.OrderCategoryIds().ShouldBe([Supplies, Equipment]);
        parsed.PersonIds().ShouldBe([Ana, Bea, Ana]);
    }

    [Fact]
    public void ResolveWithNoListsLeavesTheNamesNull()
    {
        var parsed = new ParsedAuditChanges([new ParsedAuditChange("productType", null, Supplies.ToString("D"))], null, null);

        AuditChangeLines.Resolve(parsed, new Dictionary<Guid, string>(), _ => null).Lines
            .ShouldBe([new AuditChangeLine("productType", null, null, null, null)]);
    }
}
