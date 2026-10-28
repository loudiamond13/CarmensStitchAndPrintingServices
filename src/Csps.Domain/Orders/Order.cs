using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.Orders;

/// <summary>
/// An order and everything inside it (ORD-03): its customer details, items and status history, plus a stored snapshot of its
/// money figures. The aggregate checks every rule itself and works the figures out with <see cref="OrderMath"/> only, so no caller
/// can skip a rule or bring its own totals. Every change ends by recalculating and by touching the edit version, so a change to a
/// child alone still moves the order's row version (SEC-07, SEC-08). A deleted order is only marked (D-26).
/// </summary>
public sealed class Order : IAttributedRecord, IEditVersioned
{
    private readonly List<OrderItem> _items = [];
    private readonly List<OrderDiscount> _discounts = [];
    private readonly List<OrderStatusChange> _statusChanges = [];

    // Used by EF Core (constructor binding) and by Create.
    private Order(
        Guid id,
        string customerName,
        string? teamName,
        string? contactNumber,
        string? email,
        string? address,
        DateOnly orderDate,
        DateOnly? dueDate,
        string? notes,
        OrderStatus status,
        DateTimeOffset statusChangedAtUtc)
    {
        Id = id;
        Number = string.Empty;
        CustomerName = customerName;
        TeamName = teamName;
        ContactNumber = contactNumber;
        Email = email;
        Address = address;
        OrderDate = orderDate;
        DueDate = dueDate;
        Notes = notes;
        Status = status;
        StatusChangedAtUtc = statusChangedAtUtc;
        RowVersion = [];
    }

    /// <summary>Gets the primary key, a version 7 id made by the domain.</summary>
    public Guid Id { get; private set; }

    /// <summary>Gets the order number, <c>ORD-{YYYY}-{NNNN}</c>; empty until <see cref="AssignNumber"/> is called.</summary>
    public string Number { get; private set; }

    /// <summary>Gets the customer's name, trimmed.</summary>
    public string CustomerName { get; private set; }

    /// <summary>Gets the team or club name; null when none.</summary>
    public string? TeamName { get; private set; }

    /// <summary>Gets the contact number, trimmed.</summary>
    public string? ContactNumber { get; private set; }

    /// <summary>Gets the email address; null when none.</summary>
    public string? Email { get; private set; }

    /// <summary>Gets the address; null when none.</summary>
    public string? Address { get; private set; }

    /// <summary>Gets the day the order was taken.</summary>
    public DateOnly OrderDate { get; private set; }

    /// <summary>Gets the day the order is due.</summary>
    public DateOnly? DueDate { get; private set; }

    /// <summary>Gets the notes; null when none.</summary>
    public string? Notes { get; private set; }

    /// <summary>Gets the current status.</summary>
    public OrderStatus Status { get; private set; }

    /// <summary>Gets when the status last changed, in UTC.</summary>
    public DateTimeOffset StatusChangedAtUtc { get; private set; }

    /// <summary>Gets the sum of the line totals.</summary>
    public decimal Subtotal { get; private set; }

    /// <summary>Gets the sum of the discounts.</summary>
    public decimal DiscountTotal { get; private set; }

    /// <summary>Gets the subtotal minus the discounts.</summary>
    public decimal Total { get; private set; }

    /// <summary>Gets the sum of the payments.</summary>
    public decimal PaidTotal { get; private set; }

    /// <summary>Gets the sum of the refunds.</summary>
    public decimal RefundedTotal { get; private set; }

    /// <summary>Gets the total minus paid plus refunded.</summary>
    public decimal Balance { get; private set; }

    /// <summary>Gets what the shop owes the customer; 0.00 when nothing.</summary>
    public decimal CustomerCredit { get; private set; }

    /// <summary>Gets the sum of the order expenses.</summary>
    public decimal ExpensesTotal { get; private set; }

    /// <summary>Gets the profit.</summary>
    public decimal Profit { get; private set; }

    /// <summary>Gets a value indicating whether the order is fully paid.</summary>
    public bool FullyPaid { get; private set; }

    /// <summary>Gets the stored money figures as one value.</summary>
    public OrderTotals Totals => new(Subtotal, DiscountTotal, Total, PaidTotal, RefundedTotal, Balance, CustomerCredit, ExpensesTotal, Profit, FullyPaid);

    /// <summary>Gets the items, in order.</summary>
    public IReadOnlyList<OrderItem> Items => _items;

    /// <summary>Gets the discounts, in the order they were added.</summary>
    public IReadOnlyList<OrderDiscount> Discounts => _discounts;

    /// <summary>Gets the status history rows loaded with the order.</summary>
    public IReadOnlyList<OrderStatusChange> StatusChanges => _statusChanges;

    /// <inheritdoc />
    public Guid? CreatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset CreatedAtUtc { get; private set; }

    /// <inheritdoc />
    public Guid? UpdatedById { get; private set; }

    /// <inheritdoc />
    public DateTimeOffset? UpdatedAtUtc { get; private set; }

    /// <summary>Gets when the order was soft-deleted; null while it counts (D-26).</summary>
    public DateTimeOffset? DeletedAtUtc { get; private set; }

    /// <summary>Gets who soft-deleted it; null while it counts.</summary>
    public Guid? DeletedById { get; private set; }

    /// <summary>Gets a value indicating whether the order is soft-deleted.</summary>
    public bool IsDeleted => DeletedAtUtc is not null;

    /// <inheritdoc />
    public Guid EditVersion { get; private set; }

    /// <summary>Gets the row version a save must match (409 on a conflict).</summary>
    public byte[] RowVersion { get; private set; }

    /// <summary>
    /// Makes a new order, checking every field rule again so no caller can skip one. The order has no number yet, so a refused
    /// order never takes one: call <see cref="AssignNumber"/> after this succeeds.
    /// </summary>
    /// <param name="input">The details, status and items.</param>
    /// <param name="callerId">The staff member who creates it; the first history row names them.</param>
    /// <param name="now">The current instant, which makes the keys and the history time.</param>
    /// <returns>The new, unsaved order, or a validation error naming the first broken field.</returns>
    public static Result<Order> Create(NewOrder input, Guid callerId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(input.Items);

        var details = OrderRules.CheckDetails(input.Details);
        if (details.IsFailure)
        {
            return Result.Failure<Order>(details.Error);
        }

        var status = CheckStatus(input.Status);
        if (status.IsFailure)
        {
            return Result.Failure<Order>(status.Error);
        }

        if (input.Items.Count == 0)
        {
            return OrderRules.Reject<Order>(OrderRules.ItemsField, OrderRules.ItemsRequired);
        }

        if (input.Items.Count > OrderRules.MaxItems)
        {
            return OrderRules.Reject<Order>(OrderRules.ItemsField, OrderRules.ItemsTooMany);
        }

        var checkedItems = new List<NewOrderItem>(input.Items.Count);
        for (var index = 0; index < input.Items.Count; index++)
        {
            var item = OrderRules.CheckItem(index, input.Items[index]);
            if (item.IsFailure)
            {
                return Result.Failure<Order>(item.Error);
            }

            checkedItems.Add(item.Value);
        }

        var cleaned = details.Value;
        var order = new Order(
            Guid.CreateVersion7(now),
            cleaned.CustomerName,
            cleaned.TeamName,
            cleaned.ContactNumber,
            cleaned.Email,
            cleaned.Address,
            cleaned.OrderDate,
            cleaned.DueDate,
            cleaned.Notes,
            status.Value,
            now);
        for (var position = 0; position < checkedItems.Count; position++)
        {
            order._items.Add(BuildItem(order, checkedItems[position], position, now));
        }

        order._statusChanges.Add(new OrderStatusChange(Guid.CreateVersion7(now), order.Id, null, status.Value, callerId, now) { Order = order });
        order.Recalculate();
        order.Touch(now);
        return Result.Success(order);
    }

    /// <summary>Sets the order number once, after the order passed its checks.</summary>
    /// <param name="number">The number from <see cref="OrderNumber.Format"/>.</param>
    /// <exception cref="InvalidOperationException">The order already has a number.</exception>
    public void AssignNumber(string number)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(number);
        if (Number.Length != 0)
        {
            throw new InvalidOperationException("The order already has a number.");
        }

        Number = number;
    }

    /// <summary>
    /// Applies a details edit, checking every field rule again as <see cref="Create"/> does; the due date is required even when an
    /// imported order had none (D-22). Nothing is assigned when a rule fails, and an edit that changes nothing leaves the order and
    /// its edit version untouched. Items, status and money figures are not touched.
    /// </summary>
    /// <param name="details">The customer and date details as given.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), or a validation error naming the first broken field.</returns>
    public Result<OrderDetailsChanges> UpdateDetails(OrderDetails details, DateTimeOffset now)
    {
        var checkedDetails = OrderRules.CheckDetails(details);
        if (checkedDetails.IsFailure)
        {
            return Result.Failure<OrderDetailsChanges>(checkedDetails.Error);
        }

        var cleaned = checkedDetails.Value;
        var dueDate = cleaned.DueDate!.Value;
        var fields = new List<string>();
        AddIfChanged(fields, OrderRules.CustomerNameField, CustomerName, cleaned.CustomerName);
        AddIfChanged(fields, OrderRules.TeamNameField, TeamName, cleaned.TeamName);
        AddIfChanged(fields, OrderRules.ContactNumberField, ContactNumber, cleaned.ContactNumber);
        AddIfChanged(fields, OrderRules.EmailField, Email, cleaned.Email);
        AddIfChanged(fields, OrderRules.AddressField, Address, cleaned.Address);
        AddIfChanged(fields, OrderRules.NotesField, Notes, cleaned.Notes);
        var changes = new OrderDetailsChanges(
            cleaned.OrderDate == OrderDate ? null : new ValueChange<DateOnly>(OrderDate, cleaned.OrderDate),
            dueDate == DueDate ? null : new DueDateChange(DueDate, dueDate),
            fields);
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        CustomerName = cleaned.CustomerName;
        TeamName = cleaned.TeamName;
        ContactNumber = cleaned.ContactNumber;
        Email = cleaned.Email;
        Address = cleaned.Address;
        OrderDate = cleaned.OrderDate;
        DueDate = dueDate;
        Notes = cleaned.Notes;
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>
    /// Adds one item at the end of the order, checking every item rule again and the cap of <see cref="OrderRules.MaxItems"/>. The
    /// totals are worked out again and the edit version moves, so the order's row version guards the add (ORD-08).
    /// </summary>
    /// <param name="item">The item as given.</param>
    /// <param name="now">The current instant, which makes the item key and the new edit version.</param>
    /// <returns>The new item, a validation error naming the first broken field, or a 422 when the order already has 100 items.</returns>
    public Result<OrderItem> AddItem(NewOrderItem item, DateTimeOffset now)
    {
        var checkedItem = OrderRules.CheckItem(_items.Count, item);
        if (checkedItem.IsFailure)
        {
            return Result.Failure<OrderItem>(checkedItem.Error);
        }

        if (_items.Count >= OrderRules.MaxItems)
        {
            return Result.Failure<OrderItem>(OrderRules.TooManyItems);
        }

        var added = BuildItem(this, checkedItem.Value, _items.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _items.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    /// <summary>
    /// Applies an item edit, checking every item rule again as <see cref="AddItem"/> does. Nothing is assigned when a rule fails, and
    /// an edit that changes nothing leaves the order and its edit version untouched. A changed edit works the totals out again and
    /// moves the edit version.
    /// </summary>
    /// <param name="itemId">The item to edit; it must be on this order.</param>
    /// <param name="values">The new values as given.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), a 404 when the item is not on this order, or a validation error naming the first broken field.</returns>
    public Result<OrderItemChanges> UpdateItem(Guid itemId, NewOrderItem values, DateTimeOffset now)
    {
        var item = _items.Find(existing => existing.Id == itemId);
        if (item is null)
        {
            return Result.Failure<OrderItemChanges>(OrderRules.ItemNotFound);
        }

        var checkedItem = OrderRules.CheckItem(_items.IndexOf(item), values);
        if (checkedItem.IsFailure)
        {
            return Result.Failure<OrderItemChanges>(checkedItem.Error);
        }

        var cleaned = checkedItem.Value;
        var fields = new List<string>();
        AddIfChanged(fields, OrderRules.DescriptionField, item.Description, cleaned.Description);
        AddIfChanged(fields, OrderRules.SizeVariantField, item.SizeVariant, cleaned.SizeVariant);
        var changes = new OrderItemChanges(
            item.ProductTypeId == cleaned.ProductTypeId ? null : new ValueChange<Guid>(item.ProductTypeId, cleaned.ProductTypeId),
            item.Quantity == cleaned.Quantity ? null : new ValueChange<int>(item.Quantity, cleaned.Quantity),
            item.UnitPrice == cleaned.UnitPrice ? null : new ValueChange<decimal>(item.UnitPrice, cleaned.UnitPrice),
            fields);
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        item.Apply(cleaned);
        Recalculate();
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>
    /// Takes one item off the order. An order keeps at least one item, so the last one is refused. The totals are worked out again
    /// and the edit version moves.
    /// </summary>
    /// <param name="itemId">The item to remove; it must be on this order.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>The removed item, a 404 when it is not on this order, or a 422 when it is the last one.</returns>
    public Result<OrderItem> RemoveItem(Guid itemId, DateTimeOffset now)
    {
        var item = _items.Find(existing => existing.Id == itemId);
        if (item is null)
        {
            return Result.Failure<OrderItem>(OrderRules.ItemNotFound);
        }

        if (_items.Count == 1)
        {
            return Result.Failure<OrderItem>(OrderRules.LastItem);
        }

        _items.Remove(item);
        Recalculate();
        Touch(now);
        return Result.Success(item);
    }

    /// <summary>
    /// Adds one discount at the end of the list, checking every discount rule again. The totals are worked out again and the edit
    /// version moves, so the order's row version guards the add (ORD-08).
    /// </summary>
    /// <param name="discount">The discount as given.</param>
    /// <param name="now">The current instant, which makes the discount key and the new edit version.</param>
    /// <returns>The new discount, or a validation error naming the first broken field.</returns>
    public Result<OrderDiscount> AddDiscount(NewOrderDiscount discount, DateTimeOffset now)
    {
        var checkedDiscount = OrderRules.CheckDiscount(null, discount);
        if (checkedDiscount.IsFailure)
        {
            return Result.Failure<OrderDiscount>(checkedDiscount.Error);
        }

        var added = BuildDiscount(this, checkedDiscount.Value, _discounts.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _discounts.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    private static OrderDiscount BuildDiscount(Order order, NewOrderDiscount discount, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, discount.Kind, discount.Value, discount.Reason, position) { Order = order };

    private static OrderItem BuildItem(Order order, NewOrderItem item, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, item.ProductTypeId, item.Description, item.SizeVariant, item.Quantity, item.UnitPrice, item.Quantity * item.UnitPrice, position) { Order = order };

    private static void AddIfChanged(List<string> fields, string name, string? stored, string? edited)
    {
        if (!string.Equals(stored, edited, StringComparison.Ordinal))
        {
            fields.Add(name);
        }
    }

    // Writes the money snapshot from OrderMath, the one place money is worked out (ORD-20). Payments, refunds and expenses join the
    // lists in later plans.
    private void Recalculate()
    {
        var figures = OrderMath.Compute(
            [.. _items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [.. _discounts.Select(static discount => new OrderMathDiscount(discount.Kind, discount.Value))],
            [],
            [],
            [],
            cancelled: Status == OrderStatus.Cancelled);
        Subtotal = figures.Subtotal;
        DiscountTotal = figures.Discount;
        Total = figures.Total;
        PaidTotal = figures.Paid;
        RefundedTotal = figures.Refunded;
        Balance = figures.Balance;
        CustomerCredit = figures.CustomerCredit;
        ExpensesTotal = figures.Expenses;
        Profit = figures.Profit;
        FullyPaid = figures.FullyPaid;
    }

    // Moves the edit version, so the Orders row is updated with its row version even when only a child changed.
    private void Touch(DateTimeOffset now) => EditVersion = Guid.CreateVersion7(now);

    private static Result<OrderStatus> CheckStatus(OrderStatus status)
    {
        if (!Enum.IsDefined(status))
        {
            return OrderRules.Reject<OrderStatus>(OrderRules.StatusField, OrderRules.StatusInvalid);
        }

        return OrderStatusRules.IsActive(status)
            ? Result.Success(status)
            : OrderRules.Reject<OrderStatus>(OrderRules.StatusField, OrderRules.StatusNotActive);
    }
}
