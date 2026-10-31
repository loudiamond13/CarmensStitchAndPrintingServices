using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.OrderLists;
using FluentValidation;
using FluentValidation.Results;

namespace Csps.Application.OrderLists;

/// <summary>
/// Use case: a Manager renames or recolors an entry of one of the three order lists with the version the form was opened with
/// (D-19, SEC-07). The steps run in this order and stop at the first failure: the form is checked (400), the entry is found (404),
/// the version is the stored one (409), then the name is checked (400, and Others cannot take another name). A form
/// save never retries on a conflict: the person reloads and decides. A form with no change saves nothing, writes no audit entry and
/// keeps the version. A rename writes the list's <c>.renamed</c> entry and a recolor its <c>.recolored</c> entry, both in the same
/// save (D-31). Who changed it and when come from the token and the clock (SEC-08).
/// </summary>
public sealed class UpdateOrderListEntryHandler(
    IOrderLists lists,
    IAuditTrail audit,
    IUnitOfWork unitOfWork,
    IValidator<OrderListEntryRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="kind">Which list.</param>
    /// <param name="id">The entry to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The entry as saved, a 400 listing every field that failed, a 404 when it does not exist, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<OrderListEntryDetailResponse>> HandleAsync(OrderListKind kind, Guid id, OrderListEntryRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var descriptor = OrderListDescriptor.For(kind);
        var context = new ValidationContext<OrderListEntryRequest>(request);
        context.RootContextData[OrderListEntryRequestValidator.KindKey] = kind;
        context.RootContextData[OrderListEntryRequestValidator.EditKey] = true;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.Invalid(descriptor, validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        try
        {
            var outcome = await unitOfWork.InTransactionAsync(
                token => AttemptAsync(descriptor, id, request.Name!, request.Tone!, version, token),
                cancellationToken).ConfigureAwait(false);
            if (outcome.IsFailure)
            {
                return Result.Failure<OrderListEntryDetailResponse>(outcome.Error);
            }
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<OrderListEntryDetailResponse>(EditErrors.Stale);
        }
        catch (OrderListNameTakenException)
        {
            return Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.Invalid(descriptor, new ValidationResult([OrderListErrors.NameTakenFailure()])));
        }

        var view = await lists.GetDetailAsync(kind, id, cancellationToken).ConfigureAwait(false);
        return view is null
            ? Result.Failure<OrderListEntryDetailResponse>(OrderListErrors.NotFound(descriptor))
            : Result.Success(OrderListEntryDetailResponse.From(view));
    }

    private async Task<Result<bool>> AttemptAsync(OrderListDescriptor descriptor, Guid id, string name, string tone, byte[] version, CancellationToken cancellationToken)
    {
        var entry = await lists.FindAsync(descriptor.Kind, id, cancellationToken).ConfigureAwait(false);
        if (entry is null)
        {
            return Result.Failure<bool>(OrderListErrors.NotFound(descriptor));
        }

        if (!entry.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<bool>(EditErrors.Stale);
        }

        // Others keeps its name (the domain refuses another one with a 400 on name) and needs no name lookup.
        if (!entry.IsOthers && await NameTakenByAnotherAsync(descriptor.Kind, entry, name, cancellationToken).ConfigureAwait(false))
        {
            return Result.Failure<bool>(OrderListErrors.Invalid(descriptor, new ValidationResult([OrderListErrors.NameTakenFailure()])));
        }

        var renamed = entry.Rename(name);
        if (renamed.IsFailure)
        {
            return Result.Failure<bool>(renamed.Error);
        }

        var recolored = entry.Recolor(tone);
        if (recolored.IsFailure)
        {
            return Result.Failure<bool>(recolored.Error);
        }

        var oldName = renamed.Value;
        var oldTone = recolored.Value;
        var nameChanged = !string.Equals(oldName, entry.Name, StringComparison.Ordinal);
        var toneChanged = !string.Equals(oldTone, entry.Tone, StringComparison.Ordinal);
        if (!nameChanged && !toneChanged)
        {
            return Result.Success(false);
        }

        var key = AuditKey.Of(entry.Id);
        if (nameChanged)
        {
            audit.Record(descriptor.RenamedAction, descriptor.AuditTargetType, key, OrderListAuditDetail.Renamed(oldName, entry.Name));
        }

        if (toneChanged)
        {
            audit.Record(descriptor.RecoloredAction, descriptor.AuditTargetType, key, OrderListAuditDetail.Recolored(oldTone, entry.Tone));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(true);
    }

    // Another entry's name is refused unless only the letter case of this one's own name changes.
    private async Task<bool> NameTakenByAnotherAsync(OrderListKind kind, OrderListEntry entry, string name, CancellationToken cancellationToken)
    {
        var normalized = OrderListEntry.Normalize(name);
        return normalized != entry.NormalizedName
            && await lists.NameTakenAsync(kind, normalized, entry.Id, cancellationToken).ConfigureAwait(false);
    }
}
