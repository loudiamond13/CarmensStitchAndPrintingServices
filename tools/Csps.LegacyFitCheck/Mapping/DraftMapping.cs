using System.Globalization;
using Csps.Domain.OrderLists;
using Csps.Domain.Orders;
using Csps.Domain.Time;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Source;

namespace Csps.LegacyFitCheck.Mapping;

/// <summary>One legacy order after the draft mapping: a snapshot to import, or none when the order could not be mapped.</summary>
/// <param name="LegacyKey">The legacy table and id.</param>
/// <param name="Snapshot">The order ready for the import handler, or null.</param>
/// <param name="Findings">What the mapping found.</param>
internal sealed record MappedOrder(string LegacyKey, OrderImportSnapshot? Snapshot, IReadOnlyList<Finding> Findings);

/// <summary>
/// The draft mapping from a legacy order to an import snapshot (D-04). It is provisional: it is good enough to run the check, and
/// Phase 15 writes the real mapping. Anything it cannot place is reported as "cannot map" (D-05), never guessed.
/// </summary>
internal static class DraftMapping
{
    private static readonly (TimeZoneInfo Zone, ZoneSource Source) Business = TimeZoneResolver.Resolve(TimeZoneResolver.DefaultIana);

    public static MappedOrder MapOrder(
        LegacyOrderRow order,
        IReadOnlyList<LegacyOrderItemRow> items,
        IReadOnlyDictionary<int, string?> orderTypeNames,
        IReadOnlyDictionary<int, string?> statusNames)
    {
        ArgumentNullException.ThrowIfNull(order);
        ArgumentNullException.ThrowIfNull(items);
        ArgumentNullException.ThrowIfNull(orderTypeNames);
        ArgumentNullException.ThrowIfNull(statusNames);

        var key = $"Orders:{order.OrderId.ToString(CultureInfo.InvariantCulture)}";
        var findings = new List<Finding>();

        if (order.OrderDate is not { } stored)
        {
            findings.Add(CannotMap(key, "order.date", "The order has no date."));
            return new MappedOrder(key, null, findings);
        }

        var orderDate = ToBusinessDate(stored);

        var status = ReadStatus(order.StatusId, statusNames);
        if (status is null)
        {
            findings.Add(CannotMap(key, "order.status", "The status has no clear CSPS status."));
        }

        var typeName = order.OrderTypeId is { } typeId && orderTypeNames.TryGetValue(typeId, out var name) ? name?.Trim() : null;
        var productType = OrderListSeed.ProductTypes.FirstOrDefault(row => string.Equals(row.Name, typeName, StringComparison.OrdinalIgnoreCase));
        if (productType is null)
        {
            findings.Add(new Finding(RecordKind.OrderItem, key, FindingType.CannotMap, "order.product-type", null, "The order type matches no CSPS product type.", typeName, null));
        }

        if (status is null || productType is null)
        {
            return new MappedOrder(key, null, findings);
        }

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
        var lines = items
            .Select(item => new NewOrderItem(productType.Id, item.Description.Trim(), null, item.Quantity, item.Price))
            .ToList();

        return new MappedOrder(key, new OrderImportSnapshot(number, details, status.Value, lines), findings);
    }

    // The stored datetime is read as UTC and moved to the business zone before the date is taken (provisional guess, 07.1 A3).
    private static DateOnly ToBusinessDate(DateTime stored)
    {
        var utc = DateTime.SpecifyKind(stored, DateTimeKind.Utc);
        return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(utc, Business.Zone));
    }

    private static OrderStatus? ReadStatus(int? statusId, IReadOnlyDictionary<int, string?> statusNames)
    {
        var name = statusId is { } id && statusNames.TryGetValue(id, out var found) ? found?.Trim() : null;
        return name switch
        {
            "Open" => OrderStatus.Pending,
            "In Progress" => OrderStatus.InProduction,
            "Completed" => OrderStatus.Completed,
            _ => null,
        };
    }

    private static Finding CannotMap(string key, string rule, string message) =>
        new(RecordKind.Order, key, FindingType.CannotMap, rule, null, message, null, null);
}
