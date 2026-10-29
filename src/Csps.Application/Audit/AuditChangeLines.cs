using System.Globalization;
using Csps.Application.Common;
using Csps.Application.Orders;
using Csps.Application.Users;
using Csps.Domain.Auditing;
using Csps.Domain.Orders;

namespace Csps.Application.Audit;

/// <summary>One "What changed" line of an expense, order or list entry (D-27, D-31). Text fields carry no text, only the fact that they changed.</summary>
/// <param name="Field">
/// One of <c>amount</c>, <c>date</c>, <c>category</c>, <c>name</c>, <c>tone</c>, the order fields <c>status</c>, <c>orderDate</c>,
/// <c>dueDate</c>, <c>quantity</c>, <c>unitPrice</c>, <c>kind</c>, <c>value</c>, <c>productType</c>, <c>method</c>, <c>receiver</c>,
/// <c>payer</c> and <c>refunder</c>, or the name of a text field that changed: <c>description</c>, <c>notes</c>, <c>reference</c>,
/// <c>sizeVariant</c>, <c>reason</c>, <c>customerName</c>, <c>teamName</c>, <c>contactNumber</c>, <c>email</c> or <c>address</c>.
/// </param>
/// <param name="From">
/// The old value (an amount as <c>0.00</c>, a date as <c>yyyy-MM-dd</c>, a status or kind key, a quantity, a list entry name, a tone; a
/// percentage discount value ends with <c>%</c>); null when there is none. A line that states a value as it was added or removed has no
/// old value.
/// </param>
/// <param name="To">The new value; null when there is none or the field is a text field.</param>
/// <param name="FromPerson">For <c>payer</c>, <c>receiver</c> and <c>refunder</c>: the old person.</param>
/// <param name="ToPerson">For <c>payer</c>, <c>receiver</c> and <c>refunder</c>: the new person.</param>
public sealed record AuditChangeLine(string Field, string? From, string? To, ActorRef? FromPerson, ActorRef? ToPerson);

/// <summary>The facts of an expense as an entry saw it: added, deleted, restored or permanently deleted.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="Category">The category's current name; null when the category is gone.</param>
/// <param name="Amount">The amount.</param>
/// <param name="Payer">The payer.</param>
public sealed record AuditExpenseSnapshot(DateOnly Date, string? Category, decimal Amount, ActorRef? Payer);

/// <summary>The facts of an order as a deleted, restored or permanently deleted entry saw it. It stays readable after the order row is gone (ORD-16, D-29).</summary>
/// <param name="Number">The order number, such as <c>ORD-2026-0148</c>.</param>
/// <param name="Status">The status key: <c>pending</c>, <c>mockup</c>, <c>production</c>, <c>ready</c>, <c>delivered</c>, <c>completed</c> or <c>cancelled</c>.</param>
/// <param name="Total">The order total.</param>
/// <param name="Paid">The money paid in, before refunds.</param>
/// <param name="Balance">What was still owed.</param>
public sealed record AuditOrderSnapshot(string Number, string Status, decimal Total, decimal Paid, decimal Balance);

/// <summary>The current names of the order list entries a page names, retired and deleted-from-use ones included. A missing id means the entry is gone.</summary>
/// <param name="ProductTypes">Product type names by id.</param>
/// <param name="PaymentMethods">Payment method names by id.</param>
/// <param name="OrderExpenseCategories">Order expense category names by id.</param>
public sealed record AuditListNames(
    IReadOnlyDictionary<Guid, string> ProductTypes,
    IReadOnlyDictionary<Guid, string> PaymentMethods,
    IReadOnlyDictionary<Guid, string> OrderExpenseCategories);

/// <summary>A change line before its ids are resolved: list entry and person values are dashed GUID text.</summary>
/// <param name="Field">The field name.</param>
/// <param name="From">The old value.</param>
/// <param name="To">The new value.</param>
public sealed record ParsedAuditChange(string Field, string? From, string? To);

/// <summary>A snapshot before its ids are resolved.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="CategoryId">The category id; null when the detail held none.</param>
/// <param name="Amount">The amount.</param>
/// <param name="PayerId">The payer id; null when the detail held none.</param>
public sealed record ParsedAuditSnapshot(DateOnly Date, Guid? CategoryId, decimal Amount, Guid? PayerId);

/// <summary>What the stored detail of an expense, order or list entry says, with ids still unresolved.</summary>
/// <param name="Lines">The change lines.</param>
/// <param name="Snapshot">The expense snapshot; null when the entry has none.</param>
/// <param name="PayerId">The person the entry is done to: the payer, or the new payer for a payer change; null when none.</param>
/// <param name="OrderSnapshot">The order snapshot of a deleted, restored or permanently deleted order; null otherwise.</param>
/// <param name="OrderNumber">The order number the detail itself holds (created, deleted, restored, permanently deleted); null when it holds none.</param>
public sealed record ParsedAuditChanges(
    IReadOnlyList<ParsedAuditChange> Lines,
    ParsedAuditSnapshot? Snapshot,
    Guid? PayerId,
    AuditOrderSnapshot? OrderSnapshot = null,
    string? OrderNumber = null)
{
    /// <summary>An entry with nothing to show.</summary>
    public static ParsedAuditChanges None { get; } = new([], null, null);

    /// <summary>The category ids the lines and the snapshot name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> CategoryIds()
    {
        foreach (var id in IdsOf(AuditChangeLines.CategoryField))
        {
            yield return id;
        }

        if (Snapshot?.CategoryId is { } snapshotCategory)
        {
            yield return snapshotCategory;
        }
    }

    /// <summary>The payment method ids the lines name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> PaymentMethodIds() => IdsOf(AuditChangeLines.MethodField);

    /// <summary>The product type ids the lines name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> ProductTypeIds() => IdsOf(AuditChangeLines.ProductTypeField);

    /// <summary>The order expense category ids the lines name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> OrderCategoryIds() => IdsOf(AuditChangeLines.OrderCategoryField);

    /// <summary>The people ids the lines, the snapshot and Done to name.</summary>
    /// <returns>The ids, possibly repeated.</returns>
    public IEnumerable<Guid> PersonIds()
    {
        foreach (var id in AuditChangeLines.PersonFields.SelectMany(IdsOf))
        {
            yield return id;
        }

        if (Snapshot?.PayerId is { } snapshotPayer)
        {
            yield return snapshotPayer;
        }

        if (PayerId is { } payer)
        {
            yield return payer;
        }
    }

    private IEnumerable<Guid> IdsOf(string field)
    {
        foreach (var line in Lines.Where(line => line.Field == field))
        {
            foreach (var value in new[] { line.From, line.To })
            {
                if (AuditChangeLines.TryReadId(value, out var id))
                {
                    yield return id;
                }
            }
        }
    }
}

/// <summary>
/// Reads the stored detail of expense, order and list entries into typed lines (D-27, D-31, 05 D-40). Only known keys are read and each
/// value must have the shape the writer gives it, so no free text of an expense or an order and no raw detail can pass through. The
/// only free text read is a list entry or category name, which is not personal data (D-12).
/// </summary>
public static class AuditChangeLines
{
    internal const string CategoryField = "category";
    internal const string PayerField = "payer";
    internal const string ReceiverField = "receiver";
    internal const string RefunderField = "refunder";
    internal const string MethodField = "method";
    internal const string ProductTypeField = "productType";

    /// <summary>The parsed field of an order expense's category; the line it becomes is called <c>category</c>.</summary>
    internal const string OrderCategoryField = "orderCategory";

    private const string AmountField = "amount";
    private const string DateField = "date";
    private const string NameField = "name";
    private const string ToneField = "tone";
    private const string StatusField = "status";
    private const string OrderDateField = "orderDate";
    private const string DueDateField = "dueDate";
    private const string QuantityField = "quantity";
    private const string UnitPriceField = "unitPrice";
    private const string KindField = "kind";
    private const string ValueField = "value";
    private const string NumberKey = "number";
    private const string TotalKey = "total";
    private const string PaidKey = "paid";
    private const string BalanceKey = "balance";
    private const string FieldsKey = "fields";
    private const string DateFormat = "yyyy-MM-dd";
    private const string OrderExpensePrefix = "order-expense.";
    private static readonly string[] ExpenseTextFields = ["description", "notes"];

    // The names the writers put in a fields= pair. Only these names are read, never any text.
    private static readonly string[] OrderTextFields =
    [
        "customerName", "teamName", "contactNumber", "email", "address", "notes", "description", "sizeVariant", "reference", "reason",
    ];

    /// <summary>The line fields that name a person by id.</summary>
    internal static readonly string[] PersonFields = [PayerField, ReceiverField, RefunderField];

    /// <summary>Parses the detail of an entry.</summary>
    /// <param name="action">The action code.</param>
    /// <param name="detail">The stored detail.</param>
    /// <returns>The lines, snapshot and payer; nothing for any other action.</returns>
    public static ParsedAuditChanges For(string action, string? detail)
    {
        ArgumentNullException.ThrowIfNull(action);

        if (string.IsNullOrEmpty(detail))
        {
            return ParsedAuditChanges.None;
        }

        return action switch
        {
            AuditActions.CompanyExpenseAdded
                or AuditActions.CompanyExpenseDeleted
                or AuditActions.CompanyExpenseRestored
                or AuditActions.CompanyExpensePermanentlyDeleted => ReadSnapshot(detail),
            AuditActions.CompanyExpenseChanged => ReadEdit(detail),
            AuditActions.CompanyExpensePayerChanged => ReadPayerChange(detail),
            AuditActions.ExpenseCategoryAdded
                or AuditActions.ExpenseCategoryRenamed
                or AuditActions.ExpenseCategoryRecolored
                or AuditActions.ExpenseCategoryRetired
                or AuditActions.ExpenseCategoryReactivated
                or AuditActions.ExpenseCategoryDeleted => ReadCategory(detail),
            AuditActions.ProductTypeAdded
                or AuditActions.ProductTypeRenamed
                or AuditActions.ProductTypeRecolored
                or AuditActions.ProductTypeRetired
                or AuditActions.ProductTypeReactivated
                or AuditActions.ProductTypeDeleted
                or AuditActions.PaymentMethodAdded
                or AuditActions.PaymentMethodRenamed
                or AuditActions.PaymentMethodRecolored
                or AuditActions.PaymentMethodRetired
                or AuditActions.PaymentMethodReactivated
                or AuditActions.PaymentMethodDeleted
                or AuditActions.OrderExpenseCategoryAdded
                or AuditActions.OrderExpenseCategoryRenamed
                or AuditActions.OrderExpenseCategoryRecolored
                or AuditActions.OrderExpenseCategoryRetired
                or AuditActions.OrderExpenseCategoryReactivated
                or AuditActions.OrderExpenseCategoryDeleted => ReadCategory(detail),
            AuditActions.OrderDeleted
                or AuditActions.OrderRestored
                or AuditActions.OrderPermanentlyDeleted => ReadOrderSnapshot(detail),
            AuditActions.OrderCreated
                or AuditActions.OrderItemAdded
                or AuditActions.OrderItemRemoved
                or AuditActions.OrderPaymentAdded
                or AuditActions.OrderPaymentRemoved
                or AuditActions.OrderRefundAdded
                or AuditActions.OrderRefundRemoved
                or AuditActions.OrderDiscountAdded
                or AuditActions.OrderDiscountRemoved
                or AuditActions.OrderExpenseAdded
                or AuditActions.OrderExpenseRemoved => ReadOrder(action, detail, single: true),
            AuditActions.OrderChanged
                or AuditActions.OrderStatusChanged
                or AuditActions.OrderReopened
                or AuditActions.OrderItemChanged
                or AuditActions.OrderPaymentChanged
                or AuditActions.OrderPaymentReceiverChanged
                or AuditActions.OrderRefundChanged
                or AuditActions.OrderRefundRefunderChanged
                or AuditActions.OrderDiscountChanged
                or AuditActions.OrderExpenseChanged
                or AuditActions.OrderExpensePayerChanged => ReadOrder(action, detail, single: false),
            _ => ParsedAuditChanges.None,
        };
    }

    /// <summary>Resolves the ids of parsed changes to names and people.</summary>
    /// <param name="parsed">The parsed detail.</param>
    /// <param name="categories">Current category names by id; a missing id means the category is gone.</param>
    /// <param name="person">Looks a person up by id.</param>
    /// <param name="lists">Current order list entry names, retired ones included; null when there are none to look up.</param>
    /// <returns>The lines and the expense snapshot.</returns>
    public static (IReadOnlyList<AuditChangeLine> Lines, AuditExpenseSnapshot? Snapshot) Resolve(
        ParsedAuditChanges parsed,
        IReadOnlyDictionary<Guid, string> categories,
        Func<Guid?, ActorRef?> person,
        AuditListNames? lists = null)
    {
        ArgumentNullException.ThrowIfNull(parsed);
        ArgumentNullException.ThrowIfNull(categories);
        ArgumentNullException.ThrowIfNull(person);

        string? NameOf(IReadOnlyDictionary<Guid, string>? names, string? id) =>
            names is not null && TryReadId(id, out var key) && names.TryGetValue(key, out var name) ? name : null;

        Guid? IdOf(string? id) => TryReadId(id, out var key) ? key : null;

        IReadOnlyList<AuditChangeLine> lines =
        [
            .. parsed.Lines.Select(line => line.Field switch
            {
                CategoryField => new AuditChangeLine(line.Field, NameOf(categories, line.From), NameOf(categories, line.To), null, null),
                MethodField => new AuditChangeLine(line.Field, NameOf(lists?.PaymentMethods, line.From), NameOf(lists?.PaymentMethods, line.To), null, null),
                ProductTypeField => new AuditChangeLine(line.Field, NameOf(lists?.ProductTypes, line.From), NameOf(lists?.ProductTypes, line.To), null, null),
                OrderCategoryField => new AuditChangeLine(
                    CategoryField, NameOf(lists?.OrderExpenseCategories, line.From), NameOf(lists?.OrderExpenseCategories, line.To), null, null),
                PayerField or ReceiverField or RefunderField =>
                    new AuditChangeLine(line.Field, null, null, person(IdOf(line.From)), person(IdOf(line.To))),
                _ => new AuditChangeLine(line.Field, line.From, line.To, null, null),
            }),
        ];

        var snapshot = parsed.Snapshot is { } facts
            ? new AuditExpenseSnapshot(
                facts.Date,
                facts.CategoryId is { } categoryId && categories.TryGetValue(categoryId, out var name) ? name : null,
                facts.Amount,
                person(facts.PayerId))
            : null;
        return (lines, snapshot);
    }

    internal static bool TryReadId(string? text, out Guid id) => Guid.TryParseExact(text, "D", out id);

    // date=…;category=<id>;amount=…;payer=<id>
    private static ParsedAuditChanges ReadSnapshot(string detail)
    {
        string? date = null;
        string? category = null;
        string? amount = null;
        string? payer = null;
        foreach (var part in AuditDetailFormat.Parse(detail).Where(part => part.From is null))
        {
            switch (part.Key)
            {
                case DateField:
                    date = part.To;
                    break;
                case CategoryField:
                    category = part.To;
                    break;
                case AmountField:
                    amount = part.To;
                    break;
                case PayerField:
                    payer = part.To;
                    break;
                default:
                    break;
            }
        }

        Guid? payerId = TryReadId(payer, out var payerKey) ? payerKey : null;
        ParsedAuditSnapshot? snapshot = TryReadDate(date, out var day) && TryReadAmount(amount, out var money)
            ? new ParsedAuditSnapshot(day, TryReadId(category, out var categoryKey) ? categoryKey : null, money, payerId)
            : null;
        return Build([], snapshot, payerId);
    }

    // amount, date and category as old>new, fields=description,notes, then payer=<current payer>
    private static ParsedAuditChanges ReadEdit(string detail)
    {
        List<ParsedAuditChange> lines = [];
        Guid? payerId = null;
        foreach (var part in AuditDetailFormat.Parse(detail))
        {
            switch (part.Key)
            {
                case AmountField when part.From is not null && TryReadAmount(part.From, out _) && TryReadAmount(part.To, out _):
                case DateField when part.From is not null && TryReadDate(part.From, out _) && TryReadDate(part.To, out _):
                    lines.Add(new ParsedAuditChange(part.Key, part.From, part.To));
                    break;
                case CategoryField when part.From is not null && TryReadId(part.From, out var from) && TryReadId(part.To, out var to):
                    lines.Add(new ParsedAuditChange(part.Key, from.ToString("D"), to.ToString("D")));
                    break;
                case FieldsKey when part.From is null:
                    foreach (var field in part.To.Split(',').Where(field => ExpenseTextFields.Contains(field)).Distinct())
                    {
                        lines.Add(new ParsedAuditChange(field, null, null));
                    }

                    break;
                case PayerField when part.From is null && TryReadId(part.To, out var current):
                    payerId = current;
                    break;
                default:
                    break;
            }
        }

        return Build(lines, null, payerId);
    }

    // payer=<old id>><new id>
    private static ParsedAuditChanges ReadPayerChange(string detail)
    {
        var part = AuditDetailFormat.Parse(detail).FirstOrDefault(part => part.Key == PayerField && part.From is not null);
        return part is not null && TryReadId(part.From, out var from) && TryReadId(part.To, out var to)
            ? Build([new ParsedAuditChange(PayerField, from.ToString("D"), to.ToString("D"))], null, to)
            : ParsedAuditChanges.None;
    }

    // name=<name>, name=<old>><new>, tone=<tone> or tone=<old>><new>
    private static ParsedAuditChanges ReadCategory(string detail)
    {
        List<ParsedAuditChange> lines =
        [
            .. AuditDetailFormat.Parse(detail)
                .Where(part => part.Key is NameField or ToneField)
                .Select(part => new ParsedAuditChange(part.Key, part.From, part.To)),
        ];
        return Build(lines, null, null);
    }

    // An order child entry. A single entry (added, removed) states each value as it is; an edit entry holds old>new only where a value
    // changed, then fields=<names of the text fields that changed>. Singles inside an edit are the unchanged current values and are left out.
    // A discount value reads with a percent sign while its kind is percentage, so the old and new value each carry their own unit.
    private static ParsedAuditChanges ReadOrder(string action, string detail, bool single)
    {
        var parts = AuditDetailFormat.Parse(detail);
        var (fromPercent, toPercent) = DiscountUnits(parts);
        string? number = null;
        List<ParsedAuditChange> lines = [];
        foreach (var part in parts)
        {
            if (part.Key == NumberKey)
            {
                number = part.From is null && OrderNumber.TryParse(part.To, out _, out _) ? part.To : number;
                continue;
            }

            if (part.Key == FieldsKey)
            {
                if (part.From is null)
                {
                    lines.AddRange(TextLines(part.To, OrderTextFields));
                }

                continue;
            }

            if ((part.From is null) != single || OrderFieldOf(action, part.Key) is not { } field)
            {
                continue;
            }

            // A single states no old value; an old due date is empty for an imported order that had none.
            var from = single ? null : NormalizeOrderValue(part.Key, part.From);
            var to = NormalizeOrderValue(part.Key, part.To);
            var oldValueFine = single || from is not null || (part.Key == DueDateField && part.From == string.Empty);
            if (to is null || !oldValueFine)
            {
                continue;
            }

            if (part.Key == ValueField)
            {
                from = from is null ? null : WithUnit(from, fromPercent);
                to = WithUnit(to, toPercent);
            }

            lines.Add(new ParsedAuditChange(field, from, to));
        }

        return Build(lines, null, null, null, number);
    }

    // number=…;status=…;total=…;paid=…;balance=… (a permanent delete holds more keys, which are ignored)
    private static ParsedAuditChanges ReadOrderSnapshot(string detail)
    {
        string? number = null;
        string? status = null;
        string? total = null;
        string? paid = null;
        string? balance = null;
        foreach (var part in AuditDetailFormat.Parse(detail).Where(part => part.From is null))
        {
            switch (part.Key)
            {
                case NumberKey:
                    number = part.To;
                    break;
                case StatusField:
                    status = part.To;
                    break;
                case TotalKey:
                    total = part.To;
                    break;
                case PaidKey:
                    paid = part.To;
                    break;
                case BalanceKey:
                    balance = part.To;
                    break;
                default:
                    break;
            }
        }

        if (!OrderNumber.TryParse(number, out _, out _))
        {
            return ParsedAuditChanges.None;
        }

        AuditOrderSnapshot? snapshot = OrderStatusNames.TryParse(status, out var known)
            && TryReadAmount(total, out var totalAmount)
            && TryReadAmount(paid, out var paidAmount)
            && TryReadAmount(balance, out var balanceAmount)
            ? new AuditOrderSnapshot(number!, OrderStatusNames.ToKey(known), totalAmount, paidAmount, balanceAmount)
            : null;
        return Build([], null, null, snapshot, number);
    }

    // Whether the old and the new discount kind are percentage; the kind pair is a change or the one current kind.
    private static (bool FromPercent, bool ToPercent) DiscountUnits(IReadOnlyList<AuditDetailPart> parts)
    {
        var kind = parts.FirstOrDefault(part => part.Key == KindField);
        return kind is null
            ? (false, false)
            : (IsPercentage(kind.From ?? kind.To), IsPercentage(kind.To));
    }

    private static bool IsPercentage(string text) => DiscountKindNames.TryParse(text, out var kind) && kind == DiscountKind.Percentage;

    private static string WithUnit(string amount, bool percent) => percent ? amount + "%" : amount;

    // The line field of a detail key, or null for a key the viewer does not show. An order expense's category is its own list.
    private static string? OrderFieldOf(string action, string key) => key switch
    {
        StatusField or OrderDateField or DueDateField or DateField or AmountField or QuantityField or UnitPriceField or KindField
            or ValueField or MethodField or ProductTypeField or ReceiverField or PayerField or RefunderField => key,
        CategoryField when action.StartsWith(OrderExpensePrefix, StringComparison.Ordinal) => OrderCategoryField,
        _ => null,
    };

    // The value in the form the writer gives it, or null when it has another shape.
    private static string? NormalizeOrderValue(string key, string? text) => key switch
    {
        StatusField => OrderStatusNames.TryParse(text, out var status) ? OrderStatusNames.ToKey(status) : null,
        KindField => DiscountKindNames.TryParse(text, out var kind) ? DiscountKindNames.ToKey(kind) : null,
        OrderDateField or DueDateField or DateField => TryReadDate(text, out _) ? text : null,
        AmountField or UnitPriceField or ValueField => TryReadAmount(text, out _) ? text : null,
        QuantityField => int.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out _) ? text : null,
        _ => TryReadId(text, out var id) ? id.ToString("D") : null,
    };

    private static IEnumerable<ParsedAuditChange> TextLines(string list, string[] allowed) =>
        list.Split(',').Where(allowed.Contains).Distinct().Select(static field => new ParsedAuditChange(field, null, null));

    private static ParsedAuditChanges Build(
        List<ParsedAuditChange> lines, ParsedAuditSnapshot? snapshot, Guid? payerId, AuditOrderSnapshot? orderSnapshot = null, string? orderNumber = null) =>
        lines.Count == 0 && snapshot is null && payerId is null && orderSnapshot is null && orderNumber is null
            ? ParsedAuditChanges.None
            : new ParsedAuditChanges(lines, snapshot, payerId, orderSnapshot, orderNumber);

    private static bool TryReadDate(string? text, out DateOnly date) =>
        DateOnly.TryParseExact(text, DateFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out date);

    private static bool TryReadAmount(string? text, out decimal amount) =>
        decimal.TryParse(text, NumberStyles.AllowLeadingSign | NumberStyles.AllowDecimalPoint, CultureInfo.InvariantCulture, out amount);
}
