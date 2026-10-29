using Csps.Domain.Common;
using Csps.Domain.Expenses;

namespace Csps.Domain.Orders;

/// <summary>
/// An order and everything inside it (ORD-03): its customer details, items and status history, plus a stored snapshot of its
/// money figures. The aggregate checks every rule itself and works the figures out with <see cref="OrderMath"/> only, so no caller
/// can skip a rule or bring its own totals. Every change ends by recalculating and by touching the edit version, so a change to a
/// child alone still moves the order's row version (SEC-07, SEC-08). A deleted order is only marked (D-26). Every change to the
/// order's details or children starts with <c>EnsureEditable</c>, so a Completed or Cancelled order is locked until it is reopened (D-05).
/// The one exception is a refund on a Cancelled order, which may be recorded, edited and removed without a reopen (D-05, D-35).
/// </summary>
public sealed class Order : IAttributedRecord, IEditVersioned
{
    private readonly List<OrderItem> _items = [];
    private readonly List<OrderDiscount> _discounts = [];
    private readonly List<OrderPayment> _payments = [];
    private readonly List<OrderExpense> _expenses = [];
    private readonly List<OrderRefund> _refunds = [];
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

    /// <summary>Gets the payments, in the order they were added.</summary>
    public IReadOnlyList<OrderPayment> Payments => _payments;

    /// <summary>Gets the order expenses, in the order they were added.</summary>
    public IReadOnlyList<OrderExpense> Expenses => _expenses;

    /// <summary>Gets the refunds, in the order they were added.</summary>
    public IReadOnlyList<OrderRefund> Refunds => _refunds;

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
    /// <param name="input">The details, status, items, discounts, payments and expenses.</param>
    /// <param name="callerId">The staff member who creates it; the first history row names them.</param>
    /// <param name="now">The current instant, which makes the keys and the history time.</param>
    /// <param name="today">The business today, which no payment may be dated after and which limits the expense dates; required when the order has payments or expenses.</param>
    /// <returns>The new, unsaved order, or a validation error naming the first broken field.</returns>
    /// <exception cref="ArgumentException">The order has payments or expenses but no business today was given.</exception>
    public static Result<Order> Create(NewOrder input, Guid callerId, DateTimeOffset now, DateOnly? today = null)
    {
        ArgumentNullException.ThrowIfNull(input);
        ArgumentNullException.ThrowIfNull(input.Items);
        ArgumentNullException.ThrowIfNull(input.Discounts);
        ArgumentNullException.ThrowIfNull(input.Payments);
        ArgumentNullException.ThrowIfNull(input.Expenses);
        if ((input.Payments.Count > 0 || input.Expenses.Count > 0) && today is null)
        {
            throw new ArgumentException("The business today is needed to check the payment and expense dates.", nameof(today));
        }

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

        if (input.Discounts.Count > OrderRules.MaxDiscounts)
        {
            return OrderRules.Reject<Order>(OrderRules.DiscountsField, OrderRules.DiscountsTooMany);
        }

        var checkedDiscounts = new List<NewOrderDiscount>(input.Discounts.Count);
        for (var index = 0; index < input.Discounts.Count; index++)
        {
            var discount = OrderRules.CheckDiscount(index, input.Discounts[index]);
            if (discount.IsFailure)
            {
                return Result.Failure<Order>(discount.Error);
            }

            checkedDiscounts.Add(discount.Value);
        }

        if (input.Payments.Count > OrderRules.MaxPayments)
        {
            return OrderRules.Reject<Order>(OrderRules.PaymentsField, OrderRules.PaymentsTooMany);
        }

        var checkedPayments = new List<NewOrderPayment>(input.Payments.Count);
        for (var index = 0; index < input.Payments.Count; index++)
        {
            var payment = OrderRules.CheckPayment(index, input.Payments[index], today!.Value);
            if (payment.IsFailure)
            {
                return Result.Failure<Order>(payment.Error);
            }

            checkedPayments.Add(payment.Value);
        }

        if (input.Expenses.Count > OrderRules.MaxExpenses)
        {
            return OrderRules.Reject<Order>(OrderRules.ExpensesField, OrderRules.ExpensesTooMany);
        }

        var checkedExpenses = new List<NewOrderExpense>(input.Expenses.Count);
        for (var index = 0; index < input.Expenses.Count; index++)
        {
            var expense = OrderRules.CheckExpense(index, input.Expenses[index], today!.Value);
            if (expense.IsFailure)
            {
                return Result.Failure<Order>(expense.Error);
            }

            checkedExpenses.Add(expense.Value);
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

        for (var position = 0; position < checkedDiscounts.Count; position++)
        {
            order._discounts.Add(BuildDiscount(order, checkedDiscounts[position], position, now));
        }

        if (!DiscountsFit(ItemsForMath(order._items), DiscountsForMath(order._discounts)))
        {
            return OrderRules.Reject<Order>(OrderRules.DiscountsField, OrderRules.DiscountAboveSubtotalMessage);
        }

        for (var position = 0; position < checkedPayments.Count; position++)
        {
            order._payments.Add(BuildPayment(order, checkedPayments[position], position, now));
        }

        for (var position = 0; position < checkedExpenses.Count; position++)
        {
            order._expenses.Add(BuildExpense(order, checkedExpenses[position], position, now));
        }

        order._statusChanges.Add(new OrderStatusChange(Guid.CreateVersion7(now), order.Id, null, status.Value, callerId, now) { Order = order });
        order.Recalculate();

        // The total is never below zero here (the discounts fit), so a negative balance can only come from the payments.
        if (order.Balance < 0m)
        {
            return OrderRules.Reject<Order>(OrderRules.PaymentsField, OrderRules.PaymentsAboveTotalMessage);
        }

        order.Touch(now);
        return Result.Success(order);
    }

    /// <summary>
    /// Builds an order from legacy data (ORD-21). The number is kept as given, the children keep their list order as their position,
    /// and every money figure is worked out again by <see cref="OrderMath"/> from the children, so none can be brought in. With no
    /// status history one row is written (no earlier status, no person, at <paramref name="now"/>). Nothing is saved and nothing is audited.
    /// </summary>
    /// <param name="snapshot">The legacy order.</param>
    /// <param name="rules">The relaxations to apply; <see cref="OrderImportRules.Default"/> for the migration.</param>
    /// <param name="now">The current instant, which makes the keys and the edit version.</param>
    /// <param name="today">The business today, which dated children are judged against.</param>
    /// <returns>The new, unsaved order, or a validation error naming the first broken field.</returns>
    public static Result<Order> Import(OrderImportSnapshot snapshot, OrderImportRules rules, DateTimeOffset now, DateOnly? today = null)
    {
        ArgumentNullException.ThrowIfNull(snapshot);
        ArgumentNullException.ThrowIfNull(rules);

        var checkedSnapshot = OrderImportChecks.Check(snapshot, rules, today);
        if (checkedSnapshot.IsFailure)
        {
            return Result.Failure<Order>(checkedSnapshot.Error);
        }

        snapshot = checkedSnapshot.Value;
        var details = snapshot.Details;
        IReadOnlyList<ImportedStatusChange> history = snapshot.StatusHistory.Count == 0
            ? [new ImportedStatusChange(null, snapshot.Status, null, now)]
            : snapshot.StatusHistory;
        var order = new Order(
            Guid.CreateVersion7(now),
            details.CustomerName,
            details.TeamName,
            details.ContactNumber,
            details.Email,
            details.Address,
            details.OrderDate,
            details.DueDate,
            details.Notes,
            snapshot.Status,
            history.Max(static row => row.ChangedAtUtc));
        order.AssignNumber(snapshot.Number);
        for (var position = 0; position < snapshot.Items.Count; position++)
        {
            order._items.Add(BuildItem(order, snapshot.Items[position], position, now));
        }

        for (var position = 0; position < snapshot.Discounts.Count; position++)
        {
            order._discounts.Add(BuildDiscount(order, snapshot.Discounts[position], position, now));
        }

        for (var position = 0; position < snapshot.Payments.Count; position++)
        {
            order._payments.Add(BuildPayment(order, snapshot.Payments[position], position, now));
        }

        for (var position = 0; position < snapshot.Refunds.Count; position++)
        {
            order._refunds.Add(BuildRefund(order, snapshot.Refunds[position], position, now));
        }

        for (var position = 0; position < snapshot.Expenses.Count; position++)
        {
            order._expenses.Add(BuildExpense(order, snapshot.Expenses[position], position, now));
        }

        foreach (var row in history)
        {
            order._statusChanges.Add(new OrderStatusChange(Guid.CreateVersion7(now), order.Id, row.FromStatus, row.ToStatus, row.ChangedById, row.ChangedAtUtc) { Order = order });
        }

        try
        {
            order.Recalculate();
        }
        catch (OverflowException)
        {
            // Only a percentage of a very large subtotal can overflow a decimal here.
            return OrderRules.Reject<Order>(OrderRules.DiscountsField, OrderRules.AmountTooLarge);
        }

        if (order.OversizedFigureField() is { } oversized)
        {
            return OrderRules.Reject<Order>(oversized, OrderRules.AmountTooLarge);
        }

        // These rules need the worked-out figures. The words are the create path's own.
        if (!rules.AllowDiscountAboveSubtotal && order.DiscountTotal > order.Subtotal)
        {
            return OrderRules.Reject<Order>(OrderRules.DiscountsField, OrderRules.DiscountAboveSubtotalMessage);
        }

        if (!rules.AllowOverpaid && order.Balance < 0m)
        {
            return OrderRules.Reject<Order>(OrderRules.PaymentsField, OrderRules.PaymentsAboveTotalMessage);
        }

        if (!rules.AllowCompletedWithBalance && order.Status == OrderStatus.Completed)
        {
            var settled = OrderStatusRules.Check(OrderStatus.Delivered, OrderStatus.Completed, order.Balance);
            if (settled.IsFailure)
            {
                return OrderRules.Reject<Order>(OrderRules.StatusField, settled.Error.Message);
            }
        }

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
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderDetailsChanges>(locked);
        }

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
    /// <returns>The new item, a validation error naming the first broken field, a 422 when the order already has 100 items, or a 422 when the rounded discounts would pass the new items total.</returns>
    public Result<OrderItem> AddItem(NewOrderItem item, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderItem>(locked);
        }

        var checkedItem = OrderRules.CheckItem(_items.Count, item);
        if (checkedItem.IsFailure)
        {
            return Result.Failure<OrderItem>(checkedItem.Error);
        }

        if (_items.Count >= OrderRules.MaxItems)
        {
            return Result.Failure<OrderItem>(OrderRules.TooManyItems);
        }

        var cleaned = checkedItem.Value;
        if (!DiscountsFit(ItemsForMath(_items).Append(new OrderMathItem(cleaned.Quantity, cleaned.UnitPrice)), DiscountsForMath(_discounts)))
        {
            return Result.Failure<OrderItem>(OrderRules.DiscountAboveSubtotal);
        }

        var added = BuildItem(this, cleaned, _items.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
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
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderItemChanges>(locked);
        }

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

        var edited = _items.Select(existing => existing == item ? new OrderMathItem(cleaned.Quantity, cleaned.UnitPrice) : new OrderMathItem(existing.Quantity, existing.UnitPrice));
        if (!DiscountsFit(edited, DiscountsForMath(_discounts)))
        {
            return Result.Failure<OrderItemChanges>(OrderRules.DiscountAboveSubtotal);
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
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderItem>(locked);
        }

        var item = _items.Find(existing => existing.Id == itemId);
        if (item is null)
        {
            return Result.Failure<OrderItem>(OrderRules.ItemNotFound);
        }

        if (_items.Count == 1)
        {
            return Result.Failure<OrderItem>(OrderRules.LastItem);
        }

        if (!DiscountsFit(ItemsForMath(_items.Where(existing => existing != item)), DiscountsForMath(_discounts)))
        {
            return Result.Failure<OrderItem>(OrderRules.DiscountAboveSubtotal);
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
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderDiscount>(locked);
        }

        var checkedDiscount = OrderRules.CheckDiscount(null, discount);
        if (checkedDiscount.IsFailure)
        {
            return Result.Failure<OrderDiscount>(checkedDiscount.Error);
        }

        if (_discounts.Count >= OrderRules.MaxDiscounts)
        {
            return Result.Failure<OrderDiscount>(OrderRules.TooManyDiscounts);
        }

        var cleaned = checkedDiscount.Value;
        if (!DiscountsFit(ItemsForMath(_items), DiscountsForMath(_discounts).Append(new OrderMathDiscount(cleaned.Kind, cleaned.Value))))
        {
            return OrderRules.Reject<OrderDiscount>(OrderRules.DiscountValueField, OrderRules.DiscountAboveSubtotalMessage);
        }

        var added = BuildDiscount(this, cleaned, _discounts.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _discounts.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    /// <summary>
    /// Applies a discount edit, checking every discount rule again as <see cref="AddDiscount"/> does and that the discounts still fit
    /// under the items total. Nothing is assigned when a rule fails, and an edit that changes nothing leaves the order and its edit
    /// version untouched. A changed edit works the totals out again and moves the edit version.
    /// </summary>
    /// <param name="discountId">The discount to edit; it must be on this order.</param>
    /// <param name="values">The new values as given.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), a 404 when the discount is not on this order, or a validation error naming the first broken field.</returns>
    public Result<OrderDiscountChanges> UpdateDiscount(Guid discountId, NewOrderDiscount values, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderDiscountChanges>(locked);
        }

        var discount = _discounts.Find(existing => existing.Id == discountId);
        if (discount is null)
        {
            return Result.Failure<OrderDiscountChanges>(OrderRules.DiscountNotFound);
        }

        var checkedDiscount = OrderRules.CheckDiscount(null, values);
        if (checkedDiscount.IsFailure)
        {
            return Result.Failure<OrderDiscountChanges>(checkedDiscount.Error);
        }

        var cleaned = checkedDiscount.Value;
        var changes = new OrderDiscountChanges(
            discount.Kind == cleaned.Kind ? null : new ValueChange<DiscountKind>(discount.Kind, cleaned.Kind),
            discount.Value == cleaned.Value ? null : new ValueChange<decimal>(discount.Value, cleaned.Value),
            !string.Equals(discount.Reason, cleaned.Reason, StringComparison.Ordinal));
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        var edited = _discounts.Select(existing => existing == discount ? new OrderMathDiscount(cleaned.Kind, cleaned.Value) : new OrderMathDiscount(existing.Kind, existing.Value));
        if (!DiscountsFit(ItemsForMath(_items), edited))
        {
            return OrderRules.Reject<OrderDiscountChanges>(OrderRules.DiscountValueField, OrderRules.DiscountAboveSubtotalMessage);
        }

        discount.Apply(cleaned);
        Recalculate();
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>
    /// Adds one payment at the end of the list, checking every payment rule again, the cap of <see cref="OrderRules.MaxPayments"/> and
    /// that the payment is not more than the balance (D-11). The balance is worked out from the figures as they stand, before
    /// anything is assigned, so a refused payment changes nothing. The totals are worked out again and the edit version moves, so the
    /// order's row version guards the add: two payments sent together with the same version give one winner (ORD-08).
    /// </summary>
    /// <param name="payment">The payment as given.</param>
    /// <param name="today">The business today; a payment may not be dated after it.</param>
    /// <param name="now">The current instant, which makes the payment key and the new edit version.</param>
    /// <returns>The new payment, a validation error naming the first broken field, or a 422 when the order already has 100 payments.</returns>
    public Result<OrderPayment> AddPayment(NewOrderPayment payment, DateOnly today, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderPayment>(locked);
        }

        var checkedPayment = OrderRules.CheckPayment(null, payment, today);
        if (checkedPayment.IsFailure)
        {
            return Result.Failure<OrderPayment>(checkedPayment.Error);
        }

        if (_payments.Count >= OrderRules.MaxPayments)
        {
            return Result.Failure<OrderPayment>(OrderRules.TooManyPayments);
        }

        var cleaned = checkedPayment.Value;
        var balance = Figures(_payments.Select(static existing => existing.Amount)).Balance;
        if (cleaned.Amount > balance)
        {
            return OrderRules.Reject<OrderPayment>(OrderRules.PaymentPath(null, OrderRules.PaymentAmountField), OrderRules.PaymentAboveBalance(balance));
        }

        var added = BuildPayment(this, cleaned, _payments.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _payments.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    /// <summary>
    /// Applies a payment edit, checking every payment rule again as <see cref="AddPayment"/> does. An edit may lower the amount
    /// freely, even on an order in credit, and may raise it only up to the balance plus the amount it had (D-11). Nothing is
    /// assigned when a rule fails, and an edit that changes nothing leaves the order and its edit version untouched. A changed edit
    /// works the totals out again and moves the edit version. Whether a new method or a new receiver may be chosen is not decided
    /// here: it needs the database.
    /// </summary>
    /// <param name="paymentId">The payment to edit; it must be on this order.</param>
    /// <param name="values">The new values as given.</param>
    /// <param name="today">The business today; a payment may not be dated after it.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), a 404 when the payment is not on this order, a validation error naming the first broken field, or a 422 when a lower amount would leave the payments below the refunds.</returns>
    public Result<OrderPaymentChanges> UpdatePayment(Guid paymentId, NewOrderPayment values, DateOnly today, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderPaymentChanges>(locked);
        }

        var payment = _payments.Find(existing => existing.Id == paymentId);
        if (payment is null)
        {
            return Result.Failure<OrderPaymentChanges>(OrderRules.PaymentNotFound);
        }

        var checkedPayment = OrderRules.CheckPayment(null, values, today);
        if (checkedPayment.IsFailure)
        {
            return Result.Failure<OrderPaymentChanges>(checkedPayment.Error);
        }

        var cleaned = checkedPayment.Value;
        var fields = new List<string>();
        AddIfChanged(fields, OrderRules.PaymentReferenceField, payment.Reference, cleaned.Reference);
        AddIfChanged(fields, OrderRules.PaymentNotesField, payment.Notes, cleaned.Notes);
        var changes = new OrderPaymentChanges(
            payment.PaymentDate == cleaned.PaymentDate ? null : new ValueChange<DateOnly>(payment.PaymentDate, cleaned.PaymentDate),
            payment.Amount == cleaned.Amount ? null : new ValueChange<decimal>(payment.Amount, cleaned.Amount),
            payment.PaymentMethodId == cleaned.PaymentMethodId ? null : new ValueChange<Guid>(payment.PaymentMethodId, cleaned.PaymentMethodId),
            payment.ReceivedByUserId == cleaned.ReceivedByUserId ? null : new ValueChange<Guid>(payment.ReceivedByUserId, cleaned.ReceivedByUserId),
            fields);
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        if (cleaned.Amount > payment.Amount)
        {
            var ceiling = Figures(_payments.Select(static existing => existing.Amount)).Balance + payment.Amount;
            if (cleaned.Amount > ceiling)
            {
                return OrderRules.Reject<OrderPaymentChanges>(OrderRules.PaymentPath(null, OrderRules.PaymentAmountField), OrderRules.PaymentAboveBalance(ceiling));
            }
        }
        else if (cleaned.Amount < payment.Amount
            && Figures(_payments.Select(existing => existing == payment ? cleaned.Amount : existing.Amount)).Paid < RefundedTotal)
        {
            return Result.Failure<OrderPaymentChanges>(OrderRules.PaymentBelowRefunds);
        }

        payment.Apply(cleaned);
        Recalculate();
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>Takes one payment off the order. The totals are worked out again and the edit version moves.</summary>
    /// <param name="paymentId">The payment to remove; it must be on this order.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>The removed payment, a 404 when it is not on this order, or a 422 when the payments left would be below the refunds.</returns>
    public Result<OrderPayment> RemovePayment(Guid paymentId, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderPayment>(locked);
        }

        var payment = _payments.Find(existing => existing.Id == paymentId);
        if (payment is null)
        {
            return Result.Failure<OrderPayment>(OrderRules.PaymentNotFound);
        }

        if (Figures(_payments.Where(existing => existing != payment).Select(static existing => existing.Amount)).Paid < RefundedTotal)
        {
            return Result.Failure<OrderPayment>(OrderRules.PaymentBelowRefunds);
        }

        _payments.Remove(payment);
        Recalculate();
        Touch(now);
        return Result.Success(payment);
    }

    /// <summary>
    /// Adds one order expense at the end of the list, checking every expense rule again and the cap of <see cref="OrderRules.MaxExpenses"/>.
    /// The expenses and the profit are worked out again with <see cref="OrderMath"/> (the balance never moves) and the edit version
    /// moves, so the order's row version guards the add (ORD-08).
    /// </summary>
    /// <param name="expense">The expense as given.</param>
    /// <param name="today">The business today; an expense may be dated up to 30 days after it.</param>
    /// <param name="now">The current instant, which makes the expense key and the new edit version.</param>
    /// <returns>The new expense, a validation error naming the first broken field, or a 422 when the order already has 100 expenses.</returns>
    public Result<OrderExpense> AddExpense(NewOrderExpense expense, DateOnly today, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderExpense>(locked);
        }

        var checkedExpense = OrderRules.CheckExpense(null, expense, today);
        if (checkedExpense.IsFailure)
        {
            return Result.Failure<OrderExpense>(checkedExpense.Error);
        }

        if (_expenses.Count >= OrderRules.MaxExpenses)
        {
            return Result.Failure<OrderExpense>(OrderRules.TooManyExpenses);
        }

        var added = BuildExpense(this, checkedExpense.Value, _expenses.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _expenses.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    /// <summary>
    /// Applies an order expense edit, checking every expense rule again as <see cref="AddExpense"/> does. Nothing is assigned when a
    /// rule fails, and an edit that changes nothing leaves the order and its edit version untouched. A changed edit works the
    /// expenses and the profit out again and moves the edit version. Whether a new category or a new payer may be chosen is not
    /// decided here: it needs the database.
    /// </summary>
    /// <param name="expenseId">The expense to edit; it must be on this order.</param>
    /// <param name="values">The new values as given.</param>
    /// <param name="today">The business today; an expense may be dated up to 30 days after it.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), a 404 when the expense is not on this order, or a validation error naming the first broken field.</returns>
    public Result<OrderExpenseChanges> UpdateExpense(Guid expenseId, NewOrderExpense values, DateOnly today, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderExpenseChanges>(locked);
        }

        var expense = _expenses.Find(existing => existing.Id == expenseId);
        if (expense is null)
        {
            return Result.Failure<OrderExpenseChanges>(OrderRules.ExpenseNotFound);
        }

        var checkedExpense = OrderRules.CheckExpense(null, values, today);
        if (checkedExpense.IsFailure)
        {
            return Result.Failure<OrderExpenseChanges>(checkedExpense.Error);
        }

        var cleaned = checkedExpense.Value;
        var fields = new List<string>();
        AddIfChanged(fields, OrderRules.ExpenseDescriptionField, expense.Description, cleaned.Description);
        var changes = new OrderExpenseChanges(
            expense.ExpenseDate == cleaned.ExpenseDate ? null : new ValueChange<DateOnly>(expense.ExpenseDate, cleaned.ExpenseDate),
            expense.Amount == cleaned.Amount ? null : new ValueChange<decimal>(expense.Amount, cleaned.Amount),
            expense.OrderExpenseCategoryId == cleaned.OrderExpenseCategoryId ? null : new ValueChange<Guid>(expense.OrderExpenseCategoryId, cleaned.OrderExpenseCategoryId),
            expense.PaidByUserId == cleaned.PaidByUserId ? null : new ValueChange<Guid>(expense.PaidByUserId, cleaned.PaidByUserId),
            fields);
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        expense.Apply(cleaned);
        Recalculate();
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>Takes one expense off the order. The expenses and the profit are worked out again and the edit version moves.</summary>
    /// <param name="expenseId">The expense to remove; it must be on this order.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>The removed expense, or a 404 when it is not on this order.</returns>
    public Result<OrderExpense> RemoveExpense(Guid expenseId, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderExpense>(locked);
        }

        var expense = _expenses.Find(existing => existing.Id == expenseId);
        if (expense is null)
        {
            return Result.Failure<OrderExpense>(OrderRules.ExpenseNotFound);
        }

        _expenses.Remove(expense);
        Recalculate();
        Touch(now);
        return Result.Success(expense);
    }

    /// <summary>Takes one discount off the order. The totals are worked out again and the edit version moves.</summary>
    /// <param name="discountId">The discount to remove; it must be on this order.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>The removed discount, or a 404 when it is not on this order.</returns>
    public Result<OrderDiscount> RemoveDiscount(Guid discountId, DateTimeOffset now)
    {
        if (EnsureEditable() is { } locked)
        {
            return Result.Failure<OrderDiscount>(locked);
        }

        var discount = _discounts.Find(existing => existing.Id == discountId);
        if (discount is null)
        {
            return Result.Failure<OrderDiscount>(OrderRules.DiscountNotFound);
        }

        _discounts.Remove(discount);
        Recalculate();
        Touch(now);
        return Result.Success(discount);
    }

    /// <summary>
    /// Adds one refund at the end of the list, checking every refund rule again and the cap of <see cref="OrderRules.MaxRefunds"/>.
    /// Unlike every other change, a refund is allowed on a Cancelled order (D-05); a Completed order stays locked. A refund is
    /// allowed only on a Cancelled order or one showing a customer credit (D-09). On an order that is not cancelled the amount may
    /// not pass the customer credit (D-34); on a Cancelled order it may not pass what was paid and not yet refunded (D-09). The
    /// totals are worked out again and the edit version moves, so the order's row version guards the add (ORD-08).
    /// </summary>
    /// <param name="refund">The refund as given.</param>
    /// <param name="today">The business today; a refund may not be dated after it.</param>
    /// <param name="now">The current instant, which makes the refund key and the new edit version.</param>
    /// <returns>The new refund, a validation error naming the first broken field, or a 422.</returns>
    public Result<OrderRefund> AddRefund(NewOrderRefund refund, DateOnly today, DateTimeOffset now)
    {
        if (EnsureRefundEditable() is { } locked)
        {
            return Result.Failure<OrderRefund>(locked);
        }

        var checkedRefund = OrderRules.CheckRefund(refund, today);
        if (checkedRefund.IsFailure)
        {
            return Result.Failure<OrderRefund>(checkedRefund.Error);
        }

        if (_refunds.Count >= OrderRules.MaxRefunds)
        {
            return Result.Failure<OrderRefund>(OrderRules.TooManyRefunds);
        }

        var cleaned = checkedRefund.Value;
        if (Status != OrderStatus.Cancelled && Figures(_payments.Select(static payment => payment.Amount)).CustomerCredit <= 0m)
        {
            return Result.Failure<OrderRefund>(OrderRules.RefundNotAllowed);
        }

        if (RefundCapMessage(cleaned.Amount, ownAmount: 0m) is { } tooMuch)
        {
            return OrderRules.Reject<OrderRefund>(OrderRules.RefundAmountField, tooMuch);
        }

        var added = BuildRefund(this, cleaned, _refunds.Select(static existing => existing.Position).DefaultIfEmpty(-1).Max() + 1, now);
        _refunds.Add(added);
        Recalculate();
        Touch(now);
        return Result.Success(added);
    }

    /// <summary>
    /// Applies a refund edit, checking every refund rule again as <see cref="AddRefund"/> does. An edit may lower the amount freely
    /// and may raise it only up to the cap plus the amount it had (D-34, D-09). Like an add, an edit is allowed on a Cancelled order
    /// without a reopen (D-35) and refused on a Completed one. Nothing is assigned when a rule fails, and an edit that changes
    /// nothing leaves the order and its edit version untouched. A changed edit works the totals out again and moves the edit
    /// version. Whether a new refunder may be chosen is not decided here: it needs the database.
    /// </summary>
    /// <param name="refundId">The refund to edit; it must be on this order.</param>
    /// <param name="values">The new values as given.</param>
    /// <param name="today">The business today; a refund may not be dated after it.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>What changed (nothing at all for an identical edit), a 404 when the refund is not on this order, or a validation error naming the first broken field.</returns>
    public Result<OrderRefundChanges> UpdateRefund(Guid refundId, NewOrderRefund values, DateOnly today, DateTimeOffset now)
    {
        if (EnsureRefundEditable() is { } locked)
        {
            return Result.Failure<OrderRefundChanges>(locked);
        }

        var refund = _refunds.Find(existing => existing.Id == refundId);
        if (refund is null)
        {
            return Result.Failure<OrderRefundChanges>(OrderRules.RefundNotFound);
        }

        var checkedRefund = OrderRules.CheckRefund(values, today);
        if (checkedRefund.IsFailure)
        {
            return Result.Failure<OrderRefundChanges>(checkedRefund.Error);
        }

        var cleaned = checkedRefund.Value;
        var changes = new OrderRefundChanges(
            refund.RefundDate == cleaned.RefundDate ? null : new ValueChange<DateOnly>(refund.RefundDate, cleaned.RefundDate),
            refund.Amount == cleaned.Amount ? null : new ValueChange<decimal>(refund.Amount, cleaned.Amount),
            refund.RefundedByUserId == cleaned.RefundedByUserId ? null : new ValueChange<Guid>(refund.RefundedByUserId, cleaned.RefundedByUserId),
            !string.Equals(refund.Reason, cleaned.Reason, StringComparison.Ordinal));
        if (!changes.HasAny)
        {
            return Result.Success(changes);
        }

        if (cleaned.Amount > refund.Amount && RefundCapMessage(cleaned.Amount, refund.Amount) is { } tooMuch)
        {
            return OrderRules.Reject<OrderRefundChanges>(OrderRules.RefundAmountField, tooMuch);
        }

        refund.Apply(cleaned);
        Recalculate();
        Touch(now);
        return Result.Success(changes);
    }

    /// <summary>
    /// Takes one refund off the order. Like an add, a removal is allowed on a Cancelled order without a reopen (D-35) and refused on
    /// a Completed one. The totals are worked out again and the edit version moves.
    /// </summary>
    /// <param name="refundId">The refund to remove; it must be on this order.</param>
    /// <param name="now">The current instant, which makes the new edit version.</param>
    /// <returns>The removed refund, a 404 when it is not on this order, or the locked 422.</returns>
    public Result<OrderRefund> RemoveRefund(Guid refundId, DateTimeOffset now)
    {
        if (EnsureRefundEditable() is { } locked)
        {
            return Result.Failure<OrderRefund>(locked);
        }

        var refund = _refunds.Find(existing => existing.Id == refundId);
        if (refund is null)
        {
            return Result.Failure<OrderRefund>(OrderRules.RefundNotFound);
        }

        _refunds.Remove(refund);
        Recalculate();
        Touch(now);
        return Result.Success(refund);
    }

    /// <summary>
    /// Moves the order to another status by the owner's table (<see cref="OrderStatusRules.Check"/>), judged on the balance as it
    /// stands now. A real move or a reopen adds a history row, sets the status and the time it changed, works the figures out again
    /// (a cancelled order keeps its cash and costs, D-36) and moves the edit version. A request for the status the order is already
    /// in assigns nothing.
    /// </summary>
    /// <param name="to">The status to move to.</param>
    /// <param name="callerId">The staff member who moves it; the history row names them.</param>
    /// <param name="now">The current instant, which makes the history key and time.</param>
    /// <returns>What the change did, or the 422 that refuses it.</returns>
    /// <exception cref="ArgumentOutOfRangeException">The status is not one of the seven.</exception>
    public Result<OrderStatusMove> ChangeStatus(OrderStatus to, Guid callerId, DateTimeOffset now)
    {
        var move = OrderStatusRules.Check(Status, to, Balance);
        if (move.IsFailure || move.Value == OrderStatusMove.NoChange)
        {
            return move;
        }

        _statusChanges.Add(new OrderStatusChange(Guid.CreateVersion7(now), Id, Status, to, callerId, now) { Order = this });
        Status = to;
        StatusChangedAtUtc = now;
        Recalculate();
        Touch(now);
        return move;
    }

    /// <summary>
    /// Soft-deletes the order so it and everything inside it stop counting anywhere (D-26). Any status may be deleted, so the end-state
    /// lock does not apply. A second call changes nothing.
    /// </summary>
    /// <param name="by">The staff member who deleted it.</param>
    /// <param name="now">The current instant.</param>
    /// <returns>True when it was deleted now; false when it was already deleted.</returns>
    public bool SoftDelete(Guid by, DateTimeOffset now)
    {
        if (IsDeleted)
        {
            return false;
        }

        DeletedAtUtc = now;
        DeletedById = by;
        return true;
    }

    /// <summary>Clears the delete marker so the order and everything inside it count again (D-28).</summary>
    /// <returns>True when it was restored now; false when it was not deleted.</returns>
    public bool Restore()
    {
        if (!IsDeleted)
        {
            return false;
        }

        DeletedAtUtc = null;
        DeletedById = null;
        return true;
    }

    // An order in an end state refuses every change until it is reopened (D-05, T-07-36).
    private Error? EnsureEditable() =>
        OrderStatusRules.IsLocked(Status) ? Error.BusinessRule(OrderRules.LockedCode, OrderRules.Locked(Status)) : null;

    // A refund is the one change allowed on a Cancelled order (D-05, D-35); a Completed order stays locked.
    private Error? EnsureRefundEditable() =>
        Status == OrderStatus.Completed ? Error.BusinessRule(OrderRules.LockedCode, OrderRules.Locked(Status)) : null;

    // The refund caps on the figures as they stand: a Cancelled order may hand back what was paid and not yet refunded (D-09), any
    // other order its customer credit (D-34). An edit adds back the refund's own old amount. Null when the amount fits.
    private string? RefundCapMessage(decimal amount, decimal ownAmount)
    {
        var figures = Figures(_payments.Select(static payment => payment.Amount));
        if (Status == OrderStatus.Cancelled)
        {
            var kept = figures.Paid - figures.Refunded + ownAmount;
            return amount > kept ? OrderRules.RefundAboveKept(kept) : null;
        }

        var credit = figures.CustomerCredit + ownAmount;
        return amount > credit ? OrderRules.RefundAboveCredit(credit) : null;
    }

    private static IEnumerable<OrderMathItem> ItemsForMath(IEnumerable<OrderItem> items) =>
        items.Select(static item => new OrderMathItem(item.Quantity, item.UnitPrice));

    private static IEnumerable<OrderMathDiscount> DiscountsForMath(IEnumerable<OrderDiscount> discounts) =>
        discounts.Select(static discount => new OrderMathDiscount(discount.Kind, discount.Value));

    // The one discount cap (ORD-05): the discounts, worked out by OrderMath, may not be more than the items total, so the total never
    // goes below zero. It runs on the figures a change would give, before anything is assigned.
    private static bool DiscountsFit(IEnumerable<OrderMathItem> items, IEnumerable<OrderMathDiscount> discounts)
    {
        var figures = OrderMath.Compute([.. items], [.. discounts], [], []);
        return figures.Discount <= figures.Subtotal;
    }

    private static OrderDiscount BuildDiscount(Order order, NewOrderDiscount discount, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, discount.Kind, discount.Value, discount.Reason, position) { Order = order };

    private static OrderPayment BuildPayment(Order order, NewOrderPayment payment, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, payment.PaymentDate, payment.Amount, payment.PaymentMethodId, payment.Reference, payment.Notes, payment.ReceivedByUserId, position) { Order = order };

    private static OrderRefund BuildRefund(Order order, NewOrderRefund refund, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, refund.RefundDate, refund.Amount, refund.Reason, refund.RefundedByUserId, position) { Order = order };

    private static OrderExpense BuildExpense(Order order, NewOrderExpense expense, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, expense.ExpenseDate, expense.OrderExpenseCategoryId, expense.Description, expense.Amount, expense.PaidByUserId, position) { Order = order };

    private static OrderItem BuildItem(Order order, NewOrderItem item, int position, DateTimeOffset now) =>
        new(Guid.CreateVersion7(now), order.Id, item.ProductTypeId, item.Description, item.SizeVariant, item.Quantity, item.UnitPrice, item.Quantity * item.UnitPrice, position) { Order = order };

    private static void AddIfChanged(List<string> fields, string name, string? stored, string? edited)
    {
        if (!string.Equals(stored, edited, StringComparison.Ordinal))
        {
            fields.Add(name);
        }
    }

    // Works the figures out with OrderMath, the one place money is worked out (ORD-20), for the given payment amounts and the
    // refunds as they stand.
    private OrderMathResult Figures(IEnumerable<decimal> payments) =>
        OrderMath.Compute(
            [.. ItemsForMath(_items)],
            [.. DiscountsForMath(_discounts)],
            [.. payments],
            [.. _refunds.Select(static refund => refund.Amount)],
            [.. _expenses.Select(static expense => expense.Amount)],
            cancelled: Status == OrderStatus.Cancelled);

    // Writes the money snapshot from OrderMath.
    private void Recalculate()
    {
        var figures = Figures(_payments.Select(static payment => payment.Amount));
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

    // The list a worked-out figure belongs to when it is above what its money column holds; null when every figure fits.
    private string? OversizedFigureField()
    {
        static bool Over(decimal figure) => Math.Abs(figure) > OrderRules.MoneyColumnMax;

        if (Over(Subtotal) || Over(Total))
        {
            return OrderRules.ItemsField;
        }

        if (Over(DiscountTotal))
        {
            return OrderRules.DiscountsField;
        }

        if (Over(PaidTotal))
        {
            return OrderRules.PaymentsField;
        }

        if (Over(RefundedTotal))
        {
            return OrderImportChecks.RefundsField;
        }

        if (Over(ExpensesTotal))
        {
            return OrderRules.ExpensesField;
        }

        // What is left can only come from the figures above taken together.
        return Over(Balance) || Over(CustomerCredit) ? OrderRules.PaymentsField : Over(Profit) ? OrderRules.ExpensesField : null;
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
