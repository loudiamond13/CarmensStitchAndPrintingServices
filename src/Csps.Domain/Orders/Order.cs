using Csps.Domain.Common;

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
            var item = checkedItems[position];
            order._items.Add(new OrderItem(
                Guid.CreateVersion7(now),
                order.Id,
                item.ProductTypeId,
                item.Description,
                item.SizeVariant,
                item.Quantity,
                item.UnitPrice,
                item.Quantity * item.UnitPrice,
                position) { Order = order });
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

    // Writes the money snapshot from OrderMath, the one place money is worked out (ORD-20). Discounts, payments, refunds and
    // expenses join the lists in later plans.
    private void Recalculate()
    {
        var figures = OrderMath.Compute(
            [.. _items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice))],
            [],
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
