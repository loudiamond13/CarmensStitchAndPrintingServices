using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: a staff member of either role records the customer's OK and puts an order on the website, or takes it off, with the version
/// the window was opened with (D-09 to D-16, D-38, PUB-03). The steps stop at the first failure: the form is checked (400), then one
/// transaction takes the site-content lock, finds the order (404), compares the version (409) and lets the domain apply the settings.
/// Who recorded the OK and when come from the token and the clock, never from the request (SEC-08, D-11). Showing an order adds its
/// gallery entry at the top, and taking it off removes the entry, in the same save. The lock keeps two writers from taking the same top
/// place and decides a line delete that races this save before or after it. A save never retries on a conflict: the person reloads.
/// </summary>
/// <param name="orders">The order store.</param>
/// <param name="reader">The order reader, for the answer.</param>
/// <param name="lines">The product line store, for the display order and the filing of the product types.</param>
/// <param name="gallery">The gallery entry store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class SetOrderPublicSettingsHandler(
    IOrders orders,
    IOrderReader reader,
    IProductLines lines,
    IGalleryEntries gallery,
    ISiteContentLock siteLock,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    TimeProvider time,
    IValidator<SetOrderPublicSettingsRequest> validator)
{
    /// <summary>Saves the settings.</summary>
    /// <param name="id">The order.</param>
    /// <param name="request">The window.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The order as saved, a 400 naming every field that failed, a 401 when the token names no usable account, a 404 when the order does not exist or was deleted, a 409 for a stale version or a lost race, or a 422 for a Cancelled order.</returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid id, SetOrderPublicSettingsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        var values = new OrderPublicSettings(request.CustomerConsent, request.ShowOnWebsite, request.ProductLineId, request.PublicName);

        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                token => AttemptAsync(id, values, version, callerId, token),
                cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<OrderDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OrderDetailResponse>(EditErrors.Stale);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionBusy);
        }

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, OrderPublicSettings values, byte[] version, Guid callerId, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var order = await orders.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        if (!order.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var listed = await lines.ListAsync(cancellationToken).ConfigureAwait(false);
        if (values.ProductLineId is { } chosen && listed.All(row => row.Line.Id != chosen))
        {
            return OrderRules.Reject<bool>(OrderPublicSettings.LineField, OrderPublicSettings.LineRequiredMessage);
        }

        var autoLine = AutoLineOf(order, listed);
        var now = time.GetUtcNow();
        var changes = order.SetPublicSettings(values, callerId, autoLine, now);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        if (!changes.Value.HasAny)
        {
            return Result.Success(false);
        }

        await ApplyGalleryAsync(order, changes.Value, now, cancellationToken).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
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
