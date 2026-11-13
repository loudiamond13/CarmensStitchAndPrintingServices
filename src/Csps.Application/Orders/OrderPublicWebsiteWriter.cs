using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Orders;

namespace Csps.Application.Orders;

/// <summary>
/// The one way an order's public website settings are applied (D-09 to D-16, D-38), shared by the order window, the New Order form and the
/// Edit Order form. It works in two steps inside the caller's transaction: <see cref="ApplyAsync"/> lets the domain check and set the
/// settings (the line chosen must exist, the auto line comes from the items), and <see cref="RecordAsync"/> adds or removes the gallery
/// entry and writes the audit entries naming the order and never the customer (AUDIT-01). The caller saves. The consent's who and when
/// come from the caller's token and the clock only (D-11).
/// </summary>
/// <param name="lines">The product line store, for the display order and the filing of the product types.</param>
/// <param name="gallery">The gallery entry store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
public sealed class OrderPublicWebsiteWriter(IProductLines lines, IGalleryEntries gallery, ISiteContentLock siteLock, IAuditTrail audit)
{
    /// <summary>Takes the site-content lock, so a line delete that races the save is decided before or after it. Call it first in the transaction.</summary>
    /// <param name="cancellationToken">Cancels the wait.</param>
    /// <returns>A task that ends when the lock is held.</returns>
    public Task LockAsync(CancellationToken cancellationToken) => siteLock.TakeAsync(cancellationToken);

    /// <summary>Checks and sets the settings on the order. Nothing is stored until the caller saves.</summary>
    /// <param name="order">The tracked order, or a new one not yet added.</param>
    /// <param name="values">What staff set.</param>
    /// <param name="callerId">The staff member who saves it.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="fieldPrefix">The text put before each field name in a 400 answer: empty for the order window, <see cref="OrderPublicWebsiteFields.FieldPrefix"/> for a form.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>What changed, or the error that refuses the save.</returns>
    public async Task<Result<OrderPublicSettingsChanges>> ApplyAsync(
        Order order,
        OrderPublicSettings values,
        Guid callerId,
        DateTimeOffset now,
        string fieldPrefix,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(order);
        ArgumentNullException.ThrowIfNull(values);
        ArgumentNullException.ThrowIfNull(fieldPrefix);

        var listed = await lines.ListAsync(cancellationToken).ConfigureAwait(false);
        if (values.ProductLineId is { } chosen && listed.All(row => row.Line.Id != chosen))
        {
            return Prefixed(OrderRules.Reject<OrderPublicSettingsChanges>(OrderPublicSettings.LineField, OrderPublicSettings.LineRequiredMessage), fieldPrefix);
        }

        return Prefixed(order.SetPublicSettings(values, callerId, AutoLineOf(order, listed), now), fieldPrefix);
    }

    /// <summary>Adds or removes the gallery entry and writes one audit entry for each thing that changed, for the caller's save.</summary>
    /// <param name="order">The order the changes were applied to; its number is already set.</param>
    /// <param name="changes">What <see cref="ApplyAsync"/> returned.</param>
    /// <param name="now">The current instant.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>A task that ends when the entries are marked.</returns>
    public async Task RecordAsync(Order order, OrderPublicSettingsChanges changes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(order);
        ArgumentNullException.ThrowIfNull(changes);

        await ApplyGalleryAsync(order, changes, now, cancellationToken).ConfigureAwait(false);
        RecordAudit(order, changes);
    }

    // A form's block answers with its own field names, so the form puts each message on its own control.
    private static Result<OrderPublicSettingsChanges> Prefixed(Result<OrderPublicSettingsChanges> result, string fieldPrefix)
    {
        if (result.IsSuccess || fieldPrefix.Length == 0 || result.Error.FieldErrors is not { } fields)
        {
            return result;
        }

        var error = result.Error;
        return Result.Failure<OrderPublicSettingsChanges>(Error.Validation(
            error.Code,
            error.Message,
            fields.ToDictionary(pair => string.Concat(fieldPrefix, pair.Key), static pair => pair.Value, StringComparer.Ordinal)));
    }

    // One entry for each thing that changed, in the change's own save. They name the order and never the customer (AUDIT-01).
    private void RecordAudit(Order order, OrderPublicSettingsChanges changes)
    {
        var key = AuditKey.Of(order.Id);
        if (changes.ConsentChange is { } consent)
        {
            audit.Record(consent ? AuditActions.OrderPublicConsentRecorded : AuditActions.OrderPublicConsentRemoved, OrderAuditDetail.OrderTarget, key, OrderAuditDetail.PublicSetting(order));
        }

        if (changes.ShownChange is { } shown)
        {
            audit.Record(shown ? AuditActions.OrderShownOnWebsite : AuditActions.OrderTakenOffWebsite, OrderAuditDetail.OrderTarget, key, OrderAuditDetail.PublicSetting(order));
        }

        if (changes.DetailFields.Count > 0)
        {
            audit.Record(AuditActions.OrderPublicDetailsChanged, OrderAuditDetail.OrderTarget, key, OrderAuditDetail.PublicDetailsChanged(order, changes));
        }
    }

    private static Guid? AutoLineOf(Order order, IReadOnlyList<ProductLineListRow> listed)
    {
        var lineOfType = new Dictionary<Guid, Guid>();
        foreach (var row in listed)
        {
            foreach (var typeId in row.ProductTypeIds)
            {
                lineOfType[typeId] = row.Line.Id;
            }
        }

        var items = order.Items.Select(item => new PublicFilingItem(lineOfType.TryGetValue(item.ProductTypeId, out var line) ? line : null, item.Quantity));
        return OrderPublicFiling.AutoLine(items, [.. listed.Select(row => row.Line.Id)]);
    }

    // A shown order joins the gallery at the top; an order taken off leaves it. The order's photos are never touched (D-15).
    private async Task ApplyGalleryAsync(Order order, OrderPublicSettingsChanges changes, DateTimeOffset now, CancellationToken cancellationToken)
    {
        if (changes.ShownChange is true)
        {
            var position = await gallery.GetTopPositionAsync(cancellationToken).ConfigureAwait(false);
            gallery.Add(GalleryEntry.ForOrder(order.Id, position, now));
        }
        else if (changes.ShownChange is false && await gallery.FindForOrderAsync(order.Id, cancellationToken).ConfigureAwait(false) is { } entry)
        {
            gallery.Remove(entry);
        }
    }
}
