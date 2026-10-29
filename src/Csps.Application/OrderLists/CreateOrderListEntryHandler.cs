using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.OrderLists;

/// <summary>
/// Use case: a Manager adds an entry to the product types, payment methods or order expense categories (D-19, D-20). The form is
/// checked against the field rules and, in the same 400, against the other names: no entry of the list, retired ones included, may
/// hold the same name in any letter case. The unique index decides a race, and that loss is the same field error. Who added it and
/// when come from the token and the clock (SEC-08). One audit entry joins the save (D-31). A save that loses a deadlock is a 409 and
/// is not retried.
/// </summary>
public sealed class CreateOrderListEntryHandler(
    IOrderLists lists,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    TimeProvider time,
    IValidator<OrderListEntryRequest> validator)
{
    /// <summary>Adds the entry.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new entry as the detail read shows it, a 400 listing every field that failed, or a 409 when the save lost a deadlock.</returns>
    public async Task<Result<OrderListEntryDetailResponse>> HandleAsync(OrderListKind kind, OrderListEntryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var descriptor = OrderListDescriptor.For(kind);
        var context = new ValidationContext<OrderListEntryRequest>(request);
        context.RootContextData[OrderListEntryRequestValidator.KindKey] = kind;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (validation.Errors.All(static failure => failure.PropertyName != nameof(OrderListEntryRequest.Name))
            && await lists.NameTakenAsync(kind, OrderListEntry.Normalize(request.Name!), null, cancellationToken).ConfigureAwait(false))
        {
            validation.Errors.Add(OrderListErrors.NameTakenFailure());
        }

        if (!validation.IsValid)
        {
            return Failed(descriptor, validation);
        }

        var created = descriptor.CreateEntry(request.Name!, request.Tone!, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<OrderListEntryDetailResponse>(created.Error);
        }

        var entry = created.Value;
        try
        {
            await unitOfWork.InTransactionAsync(
                async token =>
                {
                    lists.Add(entry);
                    audit.Record(descriptor.AddedAction, descriptor.AuditTargetType, AuditKey.Of(entry.Id), OrderListAuditDetail.Added(entry.Name, entry.Tone));
                    await unitOfWork.SaveChangesAsync(token).ConfigureAwait(false);
                    return entry.Id;
                },
                cancellationToken).ConfigureAwait(false);
        }
        catch (OrderListNameTakenException)
        {
            return Failed(descriptor, new ValidationResult([OrderListErrors.NameTakenFailure()]));
        }
        catch (ConcurrencyConflictException)
        {
            // A deadlock victim: the server rolled the insert back, so nothing was saved. A create has no version to read again.
            return Result.Failure<OrderListEntryDetailResponse>(AuthErrors.SessionBusy);
        }

        var view = await lists.GetDetailAsync(kind, entry.Id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.NotFound(descriptor))
            : Result.Success(OrderListEntryDetailResponse.From(view));
    }

    private static Result<OrderListEntryDetailResponse> Failed(OrderListDescriptor descriptor, ValidationResult validation) =>
        Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.Invalid(descriptor, validation));
}
