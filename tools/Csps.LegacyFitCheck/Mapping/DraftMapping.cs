using System.Globalization;
using Csps.Application.Expenses;
using Csps.Domain.Expenses;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>One legacy order after the draft mapping: a snapshot to import, or none when the order could not be mapped.</summary>
/// <param name="LegacyKey">The legacy table and id.</param>
/// <param name="Snapshot">The order ready for the import handler, or null.</param>
/// <param name="Findings">What the mapping found.</param>
/// <param name="StoredTotals">The totals the legacy order stores, or null when the order was not mapped.</param>
internal sealed record MappedOrder(string LegacyKey, OrderImportSnapshot? Snapshot, IReadOnlyList<Finding> Findings, LegacyStoredTotals? StoredTotals = null);

/// <summary>One legacy company expense after the draft mapping: the request staff would send, ready for the Phase 6 rule check.</summary>
/// <param name="LegacyKey">The legacy table and id.</param>
/// <param name="Request">The add-expense request built from the legacy row.</param>
/// <param name="Findings">What the mapping found.</param>
internal sealed record MappedCompanyExpense(string LegacyKey, CreateCompanyExpenseRequest Request, IReadOnlyList<Finding> Findings);

/// <summary>The money totals a legacy order stores, kept to compare with the CSPS math (D-08).</summary>
/// <param name="TotalAmount">The stored total after discounts; null when the order stores none.</param>
/// <param name="TotalDiscount">The stored discount total.</param>
/// <param name="PaidAmount">The stored paid amount.</param>
/// <param name="TotalBalance">The stored balance.</param>
/// <param name="TotalExpenses">The stored expenses total.</param>
internal sealed record LegacyStoredTotals(decimal? TotalAmount, decimal TotalDiscount, decimal PaidAmount, decimal TotalBalance, decimal TotalExpenses);

/// <summary>The rows that hang off one legacy order.</summary>
/// <param name="Items">The order items.</param>
/// <param name="Discounts">The discounts.</param>
/// <param name="Payments">The payments, deleted ones included.</param>
/// <param name="Expenses">The expenses of the order.</param>
internal sealed record LegacyOrderParts(
    IReadOnlyList<LegacyOrderItemRow> Items,
    IReadOnlyList<LegacyDiscountRow> Discounts,
    IReadOnlyList<LegacyPaymentRow> Payments,
    IReadOnlyList<LegacyExpenseRow> Expenses)
{
    /// <summary>Gets an order with no children.</summary>
    public static LegacyOrderParts None { get; } = new([], [], [], []);
}

/// <summary>
/// The draft mapping from a legacy order to an import snapshot (D-04). It is provisional: it is good enough to run the check, and
/// Phase 15 writes the real mapping. Anything it cannot place is reported as "cannot map" (D-05), never guessed.
/// </summary>
internal static class DraftMapping
{
    public static MappedOrder MapOrder(
        LegacyOrderRow order,
        LegacyOrderParts parts,
        IReadOnlyDictionary<int, string?> orderTypeNames,
        IReadOnlyDictionary<int, string?> statusNames,
        ListMatches lists,
        PeopleMatching? people = null)
    {
        ArgumentNullException.ThrowIfNull(order);
        ArgumentNullException.ThrowIfNull(parts);
        ArgumentNullException.ThrowIfNull(orderTypeNames);
        ArgumentNullException.ThrowIfNull(statusNames);
        ArgumentNullException.ThrowIfNull(lists);

        var key = Key("Orders", order.OrderId);
        var findings = new List<Finding>();
        people ??= PeopleMatching.Empty;

        if (order.IsDeleted == true)
        {
            findings.Add(CannotMap(key, "order.deleted", "The order is soft-deleted in the legacy data and is not imported."));
            return new MappedOrder(key, null, findings);
        }

        if (order.OrderDate is null)
        {
            findings.Add(CannotMap(key, "order.no-date", "The order has no date."));
        }

        var status = ReadStatus(order.StatusId, statusNames);
        if (status is null)
        {
            findings.Add(CannotMap(key, "order.status-unknown", "The status has no clear CSPS status."));
        }

        var typeName = order.OrderTypeId is { } typeId && orderTypeNames.TryGetValue(typeId, out var name) ? name?.Trim() : null;
        var productType = lists.ForProductType(typeName);
        var typeMissing = productType.Id is null && parts.Items.Count > 0;
        if (typeMissing)
        {
            var (rule, message) = productType.Problem == ProductTypeProblem.Blank
                ? ("list.name-blank", "The order has no order type word, so its items have no product type.")
                : ("list.name-too-long", "The order type word is longer than a CSPS list name allows.");
            findings.Add(new Finding(RecordKind.Order, key, FindingType.CannotMap, rule, null, message, productType.Problem == ProductTypeProblem.TooLong ? typeName : null, null));
        }

        if (order.OrderDate is not { } stored || status is null || typeMissing)
        {
            return new MappedOrder(key, null, findings);
        }

        var orderDate = LegacyDates.ToManilaDate(stored);
        AddDateReading(findings, RecordKind.Order, key, stored);
        findings.Add(CannotMap(key, "order.no-number", "The legacy order has no order number; one is built from the year and the legacy id."));
        findings.Add(CannotMap(key, "order.no-status-history", "The legacy order has no status history; the import writes one row."));
        var number = $"ORD-{orderDate.Year.ToString("D4", CultureInfo.InvariantCulture)}-{order.OrderId.ToString("D4", CultureInfo.InvariantCulture)}";
        var details = new OrderDetails(
            (order.OrderName ?? string.Empty).Trim(),
            null,
            null,
            null,
            null,
            orderDate,
            null,
            string.IsNullOrWhiteSpace(order.Note) ? null : order.Note.Trim());
        var snapshot = new OrderImportSnapshot(number, details, status!.Value, MapItems(parts.Items, productType, typeName, findings))
        {
            Discounts = MapDiscounts(parts.Discounts, findings),
            Payments = MapPayments(parts.Payments, people, findings),
            Expenses = MapExpenses(parts.Expenses, people, findings),
        };

        return new MappedOrder(key, snapshot, findings, new LegacyStoredTotals(order.TotalAmount, order.TotalDiscount, order.PaidAmount, order.TotalBalance, order.TotalExpenses));
    }

    /// <summary>
    /// Builds the add-expense request for one legacy company expense (D-12, D-16). The legacy row has no category, so Others is used.
    /// A missing date stays null so the validator reports it.
    /// </summary>
    public static MappedCompanyExpense MapCompanyExpense(LegacyExpenseRow expense, PeopleMatching? people = null)
    {
        ArgumentNullException.ThrowIfNull(expense);

        var key = Key("Expenses", expense.ExpenseId);
        var findings = new List<Finding>();
        string? date = null;
        if (expense.SpentDate is { } spent)
        {
            date = LegacyDates.ToManilaDate(spent).ToString(ExpenseRules.DateFormat, CultureInfo.InvariantCulture);
            AddDateReading(findings, RecordKind.CompanyExpense, key, spent);
        }

        findings.Add(new Finding(RecordKind.CompanyExpense, key, FindingType.CannotMap, "company-expense.no-category", null, "The legacy company expense has no category; Others is used.", null, null));
        var payer = (people ?? PeopleMatching.Empty).Resolve(expense.PaidBy);
        AddHolderUse(findings, RecordKind.CompanyExpense, key, "paidByUserId", "payer", payer);
        var request = new CreateCompanyExpenseRequest(date, ExpenseCategorySeed.OthersId, expense.Description?.Trim(), expense.Amount, payer.UserId, null);
        return new MappedCompanyExpense(key, request, findings);
    }

    private static List<NewOrderItem> MapItems(IReadOnlyList<LegacyOrderItemRow> rows, ProductTypeMatch productType, string? typeName, List<Finding> findings)
    {
        var items = new List<NewOrderItem>();
        foreach (var item in rows)
        {
            items.Add(new NewOrderItem(productType.Id!.Value, item.Description.Trim(), null, item.Quantity, item.Price));
            if (item.IsDone == true)
            {
                findings.Add(new Finding(RecordKind.OrderItem, Key("OrderItems", item.OrderItemId), FindingType.CannotMap, "item.done-flag", null, "CSPS items have no done flag.", null, null));
            }

            if (productType.TrialOnly)
            {
                findings.Add(new Finding(
                    RecordKind.OrderItem,
                    Key("OrderItems", item.OrderItemId),
                    FindingType.UnmatchedList,
                    "list.product-type",
                    null,
                    "The order type matches no CSPS product type; a trial-only product type was used.",
                    typeName,
                    null));
            }
        }

        return items;
    }

    private static List<NewOrderDiscount> MapDiscounts(IReadOnlyList<LegacyDiscountRow> rows, List<Finding> findings)
    {
        var discounts = new List<NewOrderDiscount>();
        foreach (var discount in rows)
        {
            discounts.Add(new NewOrderDiscount(DiscountKind.Fixed, discount.Amount, discount.Description.Trim()));
            if (!string.IsNullOrWhiteSpace(discount.DiscountedBy))
            {
                findings.Add(new Finding(RecordKind.Discount, Key("Discounts", discount.OrderDiscountId), FindingType.CannotMap, "discount.giver", null, "CSPS discounts do not record who gave them.", null, null));
            }
        }

        return discounts;
    }

    private static List<NewOrderPayment> MapPayments(IReadOnlyList<LegacyPaymentRow> rows, PeopleMatching people, List<Finding> findings)
    {
        var payments = new List<NewOrderPayment>();
        foreach (var payment in rows)
        {
            var key = Key("Payments", payment.PaymentId);
            if (payment.IsDeleted == true)
            {
                findings.Add(new Finding(RecordKind.Payment, key, FindingType.CannotMap, "payment.deleted-dropped", null, "A deleted payment is left out, as the legacy paid amount leaves it out.", null, null));
                continue;
            }

            var path = $"payments[{payments.Count.ToString(CultureInfo.InvariantCulture)}]";
            var receiver = people.Resolve(payment.PaidTo);
            payments.Add(new NewOrderPayment(
                LegacyDates.ToManilaDate(payment.PaymentDate),
                payment.Amount,
                ListMatches.UnknownPaymentMethodId,
                null,
                string.IsNullOrWhiteSpace(payment.PaidBy) ? null : payment.PaidBy.Trim(),
                receiver.UserId));
            AddDateReading(findings, RecordKind.Payment, key, payment.PaymentDate);
            findings.Add(new Finding(RecordKind.Payment, key, FindingType.CannotMap, "payment.no-method", null, "The legacy payment has no payment method.", null, null));
            AddHolderUse(findings, RecordKind.Payment, key, $"{path}.receivedByUserId", "receiver", receiver);
            if (!string.IsNullOrWhiteSpace(payment.PaidBy))
            {
                findings.Add(new Finding(RecordKind.Payment, key, FindingType.Info, "payment.payer-text-in-notes", null, "The payer text is kept in the payment notes.", null, null));
            }
        }

        return payments;
    }

    private static List<NewOrderExpense> MapExpenses(IReadOnlyList<LegacyExpenseRow> rows, PeopleMatching people, List<Finding> findings)
    {
        var expenses = new List<NewOrderExpense>();
        foreach (var expense in rows.Where(static row => !row.IsCompanyExpenses))
        {
            var key = Key("Expenses", expense.ExpenseId);
            if (expense.SpentDate is null)
            {
                findings.Add(new Finding(RecordKind.OrderExpense, key, FindingType.CannotMap, "order-expense.no-date", null, "The order expense has no date and is left out.", null, null));
                continue;
            }

            var path = $"expenses[{expenses.Count.ToString(CultureInfo.InvariantCulture)}]";
            var payer = people.Resolve(expense.PaidBy);
            expenses.Add(new NewOrderExpense(
                LegacyDates.ToManilaDate(expense.SpentDate.Value),
                expense.Amount,
                OrderListSeed.OrderExpenseOthersId,
                string.IsNullOrWhiteSpace(expense.Description) ? null : expense.Description.Trim(),
                payer.UserId));
            AddDateReading(findings, RecordKind.OrderExpense, key, expense.SpentDate.Value);
            findings.Add(new Finding(RecordKind.OrderExpense, key, FindingType.CannotMap, "order-expense.no-category", null, "The legacy order expense has no category; Others is used.", null, null));
            AddHolderUse(findings, RecordKind.OrderExpense, key, $"{path}.paidByUserId", "payer", payer);
        }

        return expenses;
    }

    // Every use of the Legacy holder is an unmatched-person finding with its reason and a holder-used finding for the count (D-06).
    private static void AddHolderUse(List<Finding> findings, RecordKind kind, string key, string path, string role, PersonMatch match)
    {
        if (!match.IsHolder)
        {
            return;
        }

        var reason = match.RuleKey switch
        {
            "person.blank" => $"The {role} text is empty.",
            "person.role-no-match" => $"The {role} is a legacy user whose role has no CSPS staff match.",
            _ => $"The {role} matches no legacy user.",
        };
        findings.Add(new Finding(kind, key, FindingType.UnmatchedPerson, match.RuleKey!, path, reason, match.ListValue, null));
        findings.Add(new Finding(kind, key, FindingType.LegacyHolderUsed, "person.legacy-holder", path, $"The {role} is the Legacy holder.", null, null));
    }

    private static string Key(string table, int id) => $"{table}:{id.ToString(CultureInfo.InvariantCulture)}";

    // A record whose two date readings differ is counted for the owner's ruling (provisional, 07.1 A3).
    private static void AddDateReading(List<Finding> findings, RecordKind kind, string key, DateTime stored)
    {
        if (LegacyDates.Differs(stored))
        {
            findings.Add(new Finding(kind, key, FindingType.Info, "dates.reading-differs", null, "The date differs between the as-stored and the Manila reading.", null, null));
        }
    }

    private static OrderStatus? ReadStatus(int? statusId, IReadOnlyDictionary<int, string?> statusNames)
    {
        var name = statusId is { } id && statusNames.TryGetValue(id, out var found) ? found?.Trim() : null;
        if (string.Equals(name, "Open", StringComparison.OrdinalIgnoreCase))
        {
            return OrderStatus.Pending;
        }

        if (string.Equals(name, "In Progress", StringComparison.OrdinalIgnoreCase))
        {
            return OrderStatus.InProduction;
        }

        return string.Equals(name, "Completed", StringComparison.OrdinalIgnoreCase) ? OrderStatus.Completed : null;
    }

    private static Finding CannotMap(string key, string rule, string message) =>
        new(RecordKind.Order, key, FindingType.CannotMap, rule, null, message, null, null);
}
