using System.Reflection;
using Csps.Domain.Common;
using Csps.Domain.Expenses;
using Csps.Domain.Orders;

namespace Csps.Domain.UnitTests.Orders;

/// <summary>ORD-05, D-21, D-22, D-31: a details edit checks every rule again, assigns only on a real change and reports what moved.</summary>
public sealed class OrderDetailsTests
{
    private static readonly DateTimeOffset Created = new(2026, 10, 28, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateTimeOffset Later = new(2026, 10, 29, 3, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly OrderDay = new(2026, 10, 28);

    private static readonly (string Field, string Message, Func<OrderDetails, OrderDetails> BreakIt)[] BrokenFields =
    [
        ("customerName", OrderRules.CustomerNameRequired, details => details with { CustomerName = "  " }),
        ("customerName", OrderRules.CustomerNameTooLong, details => details with { CustomerName = new string('a', 101) }),
        ("teamName", OrderRules.TeamNameTooLong, details => details with { TeamName = new string('a', 101) }),
        ("contactNumber", OrderRules.ContactNumberRequired, details => details with { ContactNumber = null }),
        ("contactNumber", OrderRules.ContactNumberTooLong, details => details with { ContactNumber = new string('1', 31) }),
        ("contactNumber", OrderRules.ContactNumberInvalid, details => details with { ContactNumber = "0917-abc" }),
        ("email", OrderRules.EmailTooLong, details => details with { Email = new string('a', 250) + "@x.co" }),
        ("email", OrderRules.EmailInvalid, details => details with { Email = "not an email" }),
        ("address", OrderRules.AddressTooLong, details => details with { Address = new string('a', 301) }),
        ("dueDate", OrderRules.DueDateRequired, details => details with { DueDate = null }),
        ("dueDate", OrderRules.DueDateBeforeOrderDate, details => details with { DueDate = OrderDay.AddDays(-1) }),
        ("notes", OrderRules.NotesTooLong, details => details with { Notes = new string('a', 2001) }),
    ];

    [Fact]
    public void EachBrokenFieldIsRefusedWithItsMessageAndNothingIsAssigned()
    {
        foreach (var (field, message, breakIt) in BrokenFields)
        {
            var order = NewOrder();
            var editVersion = order.EditVersion;

            var result = order.UpdateDetails(breakIt(ValidDetails()), Later);

            result.IsFailure.ShouldBeTrue(message);
            result.Error.Kind.ShouldBe(ErrorKind.Validation, message);
            var fields = result.Error.FieldErrors.ShouldNotBeNull();
            fields.Keys.ShouldBe([field], message);
            fields[field].ShouldBe([message]);
            order.EditVersion.ShouldBe(editVersion, message);
            order.CustomerName.ShouldBe("Juan Dela Cruz", message);
            order.DueDate.ShouldBe(OrderDay.AddDays(14), message);
        }
    }

    [Fact]
    public void AMissingDueDateIsRefusedEvenWhenTheStoredOneIsNull()
    {
        var order = NewOrder();
        typeof(Order).GetProperty(nameof(Order.DueDate), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, null);

        var result = order.UpdateDetails(ValidDetails() with { DueDate = null }, Later);

        result.IsFailure.ShouldBeTrue();
        result.Error.FieldErrors.ShouldNotBeNull()["dueDate"].ShouldBe([OrderRules.DueDateRequired]);
        order.DueDate.ShouldBeNull();
    }

    [Fact]
    public void AnImportedOrderWithNoDueDateGetsOneOnEdit()
    {
        var order = NewOrder();
        typeof(Order).GetProperty(nameof(Order.DueDate), BindingFlags.Instance | BindingFlags.Public)!.SetValue(order, null);

        var result = order.UpdateDetails(ValidDetails(), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.DueDate.ShouldBe(new DueDateChange(null, OrderDay.AddDays(14)));
        result.Value.OrderDate.ShouldBeNull();
        result.Value.ChangedFields.ShouldBeEmpty();
        order.DueDate.ShouldBe(OrderDay.AddDays(14));
    }

    [Fact]
    public void IdenticalDetailsChangeNothingAndKeepTheEditVersion()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;

        var result = order.UpdateDetails(ValidDetails(), Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.HasAny.ShouldBeFalse();
        result.Value.OrderDate.ShouldBeNull();
        result.Value.DueDate.ShouldBeNull();
        result.Value.ChangedFields.ShouldBeEmpty();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void TextThatOnlyDiffersInSpacesIsNotAChange()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;
        var spaced = ValidDetails() with { CustomerName = "  Juan Dela Cruz ", TeamName = " Brgy. San Roque Ballers  ", Notes = "   ", Address = "" };

        var result = order.UpdateDetails(spaced, Later);

        result.Value.HasAny.ShouldBeFalse();
        order.EditVersion.ShouldBe(editVersion);
    }

    [Fact]
    public void AChangedCustomerNameIsListedByNameAndMovesTheEditVersion()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;

        var result = order.UpdateDetails(ValidDetails() with { CustomerName = "  Maria Santos " }, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ChangedFields.ShouldBe(["customerName"]);
        result.Value.OrderDate.ShouldBeNull();
        result.Value.DueDate.ShouldBeNull();
        result.Value.HasAny.ShouldBeTrue();
        order.CustomerName.ShouldBe("Maria Santos");
        order.EditVersion.ShouldNotBe(editVersion);
        order.EditVersion.Version.ShouldBe(7);
    }

    [Fact]
    public void AChangedDueDateReturnsItsOldAndNewDayAndMovesTheEditVersion()
    {
        var order = NewOrder();
        var editVersion = order.EditVersion;

        var result = order.UpdateDetails(ValidDetails() with { DueDate = OrderDay.AddDays(21) }, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.DueDate.ShouldBe(new DueDateChange(OrderDay.AddDays(14), OrderDay.AddDays(21)));
        result.Value.OrderDate.ShouldBeNull();
        result.Value.ChangedFields.ShouldBeEmpty();
        order.DueDate.ShouldBe(OrderDay.AddDays(21));
        order.EditVersion.ShouldNotBe(editVersion);
    }

    [Fact]
    public void ChangingEveryFieldListsThemInFormOrderWithBothDatePairs()
    {
        var order = NewOrder();
        var changed = new OrderDetails(
            "Maria Santos",
            "Riders",
            "0918 555 0101",
            "maria@example.com",
            "Quezon City",
            OrderDay.AddDays(-2),
            OrderDay.AddDays(30),
            "rush");

        var result = order.UpdateDetails(changed, Later);

        result.IsSuccess.ShouldBeTrue();
        result.Value.ChangedFields.ShouldBe(["customerName", "teamName", "contactNumber", "email", "address", "notes"]);
        result.Value.OrderDate.ShouldBe(new ValueChange<DateOnly>(OrderDay, OrderDay.AddDays(-2)));
        result.Value.DueDate.ShouldBe(new DueDateChange(OrderDay.AddDays(14), OrderDay.AddDays(30)));
        order.TeamName.ShouldBe("Riders");
        order.ContactNumber.ShouldBe("0918 555 0101");
        order.Email.ShouldBe("maria@example.com");
        order.Address.ShouldBe("Quezon City");
        order.Notes.ShouldBe("rush");
        order.OrderDate.ShouldBe(OrderDay.AddDays(-2));
    }

    [Fact]
    public void ClearingAnOptionalFieldIsAChangeAndStoresNull()
    {
        var order = NewOrder();

        var result = order.UpdateDetails(ValidDetails() with { TeamName = " ", Email = null }, Later);

        result.Value.ChangedFields.ShouldBe(["teamName", "email"]);
        order.TeamName.ShouldBeNull();
        order.Email.ShouldBeNull();
    }

    [Fact]
    public void ADetailsEditNeverTouchesItemsStatusOrMoney()
    {
        var order = NewOrder();
        var totals = order.Totals;
        var status = order.Status;
        var itemIds = order.Items.Select(static item => item.Id).ToList();

        order.UpdateDetails(ValidDetails() with { CustomerName = "Someone Else", DueDate = OrderDay.AddDays(40) }, Later).IsSuccess.ShouldBeTrue();

        order.Totals.ShouldBe(totals);
        order.Status.ShouldBe(status);
        order.Items.Select(static item => item.Id).ShouldBe(itemIds);
    }

    [Fact]
    public void ADroppedDetailsObjectIsAProgrammingError() =>
        Should.Throw<ArgumentNullException>(() => NewOrder().UpdateDetails(null!, Later));

    private static Order NewOrder()
    {
        var items = new[] { new NewOrderItem(Guid.Parse("01a17fce-7800-7f5d-bc6c-5d14ceeca0c6"), "Jersey top", "S-XL", 15, 650.00m) };
        return Order.Create(new NewOrder(ValidDetails(), OrderStatus.Pending, items), Guid.NewGuid(), Created).Value;
    }

    private static OrderDetails ValidDetails() => new(
        "Juan Dela Cruz",
        "Brgy. San Roque Ballers",
        "0917 123 4567",
        "juan.dc@example.com",
        null,
        OrderDay,
        OrderDay.AddDays(14),
        null);
}
