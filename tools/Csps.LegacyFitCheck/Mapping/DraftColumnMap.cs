using Csps.LegacyFitCheck.Findings;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>
/// One legacy column and where the draft mapping puts it: a CSPS target, or a reason it has none and the finding type to raise.
/// </summary>
/// <param name="Table">The legacy table.</param>
/// <param name="Column">The legacy column.</param>
/// <param name="Target">Where the column goes, or null when it is not mapped.</param>
/// <param name="Reason">Why the column is not mapped, or null when it is mapped.</param>
/// <param name="Type">The finding type for a not-mapped column (CannotMap or NotChecked), or null when it is mapped.</param>
internal sealed record ColumnEntry(string Table, string Column, string? Target, string? Reason, FindingType? Type)
{
    public bool IsMapped => Target is not null;

    public string Path => $"{Table}.{Column}";

    public static ColumnEntry Mapped(string table, string column, string target) => new(table, column, target, null, null);

    public static ColumnEntry NotMapped(string table, string column, string reason, FindingType type) => new(table, column, null, reason, type);
}

/// <summary>
/// Every column of the seven in-scope legacy tables, as mapped or not mapped with a reason (D-05). Provisional by D-04: it is
/// good enough to run the check, and Phase 15 writes the real mapping. Names only, never a value.
/// </summary>
internal static class DraftColumnMap
{
    /// <summary>The people tables are read only to match people, so their columns are left out of the inventory (D-09).</summary>
    public const string PeopleTablesReason = "read only to match people (D-09)";

    private const string Creator = "creator attribution, Phase 15";
    private const string Stamp = "edit date stamp, Phase 15";

    public static IReadOnlyList<string> Tables { get; } =
        ["Orders", "OrderItems", "Payments", "Discounts", "Expenses", "OrderTypes", "Statuses"];

    public static IReadOnlyList<string> PeopleTables { get; } = ["AspNetUsers", "AspNetRoles", "AspNetUserRoles"];

    public static IReadOnlyList<ColumnEntry> Entries { get; } =
    [
        ColumnEntry.Mapped("Orders", "OrderId", "legacy key and the derived order number"),
        ColumnEntry.Mapped("Orders", "OrderName", "customer name"),
        ColumnEntry.Mapped("Orders", "OrderDate", "order date, read as UTC and moved to the business zone"),
        ColumnEntry.Mapped("Orders", "TotalAmount", "compared with the CSPS total (D-08)"),
        ColumnEntry.Mapped("Orders", "Note", "order notes"),
        ColumnEntry.Mapped("Orders", "IsDeleted", "soft-delete check, a deleted order is cannot map"),
        ColumnEntry.Mapped("Orders", "PaidAmount", "compared with the CSPS paid total (D-08)"),
        ColumnEntry.Mapped("Orders", "TotalDiscount", "compared with the CSPS discount total (D-08)"),
        ColumnEntry.Mapped("Orders", "TotalBalance", "compared with the CSPS balance (D-08)"),
        ColumnEntry.Mapped("Orders", "TotalExpenses", "compared with the CSPS expenses total (D-08)"),
        ColumnEntry.Mapped("Orders", "OrderTypeId", "product type, through OrderTypes"),
        ColumnEntry.Mapped("Orders", "StatusId", "order status, through Statuses"),
        ColumnEntry.NotMapped("Orders", "CreatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Orders", "UpdatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Orders", "DeletedBy", Creator, FindingType.NotChecked),

        ColumnEntry.Mapped("OrderItems", "OrderItemId", "legacy key"),
        ColumnEntry.Mapped("OrderItems", "OrderId", "the order the item belongs to"),
        ColumnEntry.Mapped("OrderItems", "Description", "item description"),
        ColumnEntry.Mapped("OrderItems", "Quantity", "item quantity"),
        ColumnEntry.Mapped("OrderItems", "Price", "item unit price"),
        ColumnEntry.NotMapped("OrderItems", "IsDone", "CSPS items have no done flag", FindingType.CannotMap),
        ColumnEntry.NotMapped("OrderItems", "CreatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("OrderItems", "UpdatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("OrderItems", "CreatedDate", Stamp, FindingType.NotChecked),
        ColumnEntry.NotMapped("OrderItems", "UpdatedDate", Stamp, FindingType.NotChecked),

        ColumnEntry.Mapped("Payments", "PaymentId", "legacy key"),
        ColumnEntry.Mapped("Payments", "OrderId", "the order the payment belongs to"),
        ColumnEntry.Mapped("Payments", "PaymentDate", "payment date, read as UTC and moved to the business zone"),
        ColumnEntry.Mapped("Payments", "PaidBy", "payment notes (provisional)"),
        ColumnEntry.Mapped("Payments", "IsDeleted", "a deleted payment is left out and reported"),
        ColumnEntry.Mapped("Payments", "Amount", "payment amount"),
        ColumnEntry.Mapped("Payments", "PaidTo", "who received the payment, matched to staff"),
        ColumnEntry.NotMapped("Payments", "CreatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Payments", "UpdatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Payments", "DeletedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Payments", "UpdatedDate", Stamp, FindingType.NotChecked),

        ColumnEntry.Mapped("Discounts", "OrderDiscountId", "legacy key"),
        ColumnEntry.Mapped("Discounts", "OrderId", "the order the discount belongs to"),
        ColumnEntry.Mapped("Discounts", "Description", "discount reason"),
        ColumnEntry.Mapped("Discounts", "Amount", "fixed discount value"),
        ColumnEntry.NotMapped("Discounts", "DiscountedBy", "CSPS discounts have no person", FindingType.CannotMap),
        ColumnEntry.NotMapped("Discounts", "UpdatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Discounts", "DiscountDate", Stamp, FindingType.NotChecked),
        ColumnEntry.NotMapped("Discounts", "UpdateDate", Stamp, FindingType.NotChecked),

        ColumnEntry.Mapped("Expenses", "ExpenseId", "legacy key"),
        ColumnEntry.Mapped("Expenses", "OrderId", "the order of an order expense"),
        ColumnEntry.Mapped("Expenses", "Description", "expense description"),
        ColumnEntry.Mapped("Expenses", "SpentDate", "expense date, read as UTC and moved to the business zone"),
        ColumnEntry.Mapped("Expenses", "isCompanyExpenses", "order expense or company expense"),
        ColumnEntry.Mapped("Expenses", "Amount", "expense amount"),
        ColumnEntry.Mapped("Expenses", "PaidBy", "who paid the expense, matched to staff"),
        ColumnEntry.NotMapped("Expenses", "UpdatedBy", Creator, FindingType.NotChecked),
        ColumnEntry.NotMapped("Expenses", "UpdatedDate", Stamp, FindingType.NotChecked),

        ColumnEntry.Mapped("OrderTypes", "OrderTypeId", "legacy key"),
        ColumnEntry.Mapped("OrderTypes", "OrderTypeName", "product type name"),

        ColumnEntry.Mapped("Statuses", "StatusId", "legacy key"),
        ColumnEntry.Mapped("Statuses", "StatusName", "order status name"),
        ColumnEntry.NotMapped("Statuses", "StatusCategory", "CSPS statuses have no category", FindingType.CannotMap),
    ];
}
