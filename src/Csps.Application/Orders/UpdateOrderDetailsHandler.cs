using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using FluentValidation;

namespace Csps.Application.Orders;

/// <summary>
/// Use case: any staff member edits an order's customer details, dates and notes with the version the form was opened with
/// (ORD-05, ORD-08, SEC-07). The steps stop at the first failure: the form is checked (400), the order is found (404), the version
/// is the stored one (409), then the domain checks every rule again (400). There is no own-order rule: Admin and Manager may edit
/// any order (D-25). A form save never retries on a conflict: the person reloads and decides. A form with no change saves nothing
/// and keeps the version; a change writes one <c>order.changed</c> entry (dates as old and new, field names only, never customer
/// text) in the same save (D-31). Who changed the order and when come from the token and the clock, never from the request (SEC-08).
/// </summary>
public sealed class UpdateOrderDetailsHandler(
    IOrders orders,
    IOrderReader reader,
    IBusinessCalendar calendar,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IRequestContext requestContext,
    IValidator<UpdateOrderDetailsRequest> validator)
{
    private const string OrderTarget = "Order";

    /// <summary>Saves the edit.</summary>
    /// <param name="id">The order to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>
    /// The order as saved, a 400 listing every field that failed, a 401 when the token names no usable account, a 404 when it does
    /// not exist or was deleted, a 409 for a stale version or a lost race, or a 422 when the order is completed or cancelled.
    /// </returns>
    public async Task<Result<OrderDetailResponse>> HandleAsync(Guid id, UpdateOrderDetailsRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        if (requestContext.UserId is null)
        {
            return Result.Failure<OrderDetailResponse>(AuthErrors.SessionEnded);
        }

        var validation = await LegacyEditFilter.RelaxAsync(
            await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false),
            reader,
            id,
            view => LegacyEditFilter.Unchanged(
                (nameof(IOrderDetailsFields.ContactNumber), string.IsNullOrWhiteSpace(request.ContactNumber) && string.IsNullOrWhiteSpace(view.ContactNumber))),
            cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderDetailResponse>(ValidationResults.ToError(validation, OrderErrors.ValidationCode, OrderErrors.ValidationMessage));
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        _ = RowVersions.TryParse(request.Version, out var version);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.OrderDate, out var orderDate);
        _ = OrderDetailsFieldsValidator.TryParseDate(request.DueDate, out var dueDate);
        var details = new OrderDetails(request.CustomerName!, request.TeamName, request.ContactNumber, request.Email, request.Address, orderDate, dueDate, request.Notes);

        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                token => AttemptAsync(id, details, version, clock.UtcNow, token),
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

        var view = await reader.GetDetailAsync(id, cancellationToken).ConfigureAwait(false);
        return view is null ? Result.Failure<OrderDetailResponse>(OrderErrors.NotFound) : Result.Success(view);
    }

    private async Task<Result<bool>> AttemptAsync(Guid id, OrderDetails details, byte[] version, DateTimeOffset now, CancellationToken cancellationToken)
    {
        var order = await orders.FindAsync(id, includeDeleted: false, cancellationToken).ConfigureAwait(false);
        if (order is null)
        {
            return Result.Failure<bool>(OrderErrors.NotFound);
        }

        if (!order.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        var changes = order.UpdateDetails(details, now);
        if (changes.IsFailure)
        {
            return Result.Failure<bool>(changes.Error);
        }

        if (!changes.Value.HasAny)
        {
            return Result.Success(false);
        }

        audit.Record(AuditActions.OrderChanged, OrderTarget, AuditKey.Of(order.Id), OrderAuditDetail.DetailsChanged(changes.Value));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }
}
