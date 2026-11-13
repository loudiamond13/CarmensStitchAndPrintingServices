using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
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
/// <param name="publicWebsite">The writer that applies the settings, adds or removes the gallery entry and writes the audit entries.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class SetOrderPublicSettingsHandler(
    IOrders orders,
    IOrderReader reader,
    OrderPublicWebsiteWriter publicWebsite,
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
        await publicWebsite.LockAsync(cancellationToken).ConfigureAwait(false);
        var order = await orders.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        if (!order.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var now = time.GetUtcNow();
        var changes = await publicWebsite.ApplyAsync(order, values, callerId, now, string.Empty, cancellationToken).ConfigureAwait(false);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        if (!changes.Value.HasAny)
        {
            return Result.Success(false);
        }

        await publicWebsite.RecordAsync(order, changes.Value, now, cancellationToken).ConfigureAwait(false);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
