using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager edits a closure with the version the form was opened with (CONT-04, SEC-07). The steps run in this order and
/// stop at the first failure: the form is checked (400), the closure is found (404), the version is the stored one (409), then the
/// days are checked (400). A form save never retries on a conflict. A form with no change saves nothing and keeps the version.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="validator">The form rules.</param>
public sealed class UpdateShopClosureHandler(
    ISiteContentStore store,
    ISiteContentLock siteLock,
    IUnitOfWork unitOfWork,
    IBusinessCalendar calendar,
    IValidator<ShopClosureRequest> validator)
{
    /// <summary>Saves the edit.</summary>
    /// <param name="id">The closure to edit.</param>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The closure as saved, a 400 naming every field that failed, a 404 when it does not exist, or a 409 for a stale version or a lost race.</returns>
    public async Task<Result<ShopClosureDto>> HandleAsync(Guid id, ShopClosureRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<ShopClosureRequest>(request);
        context.RootContextData[ShopClosureRequestValidator.TodayKey] = clock.Today;
        context.RootContextData[ShopClosureRequestValidator.EditKey] = true;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ShopClosureDto>(SiteContentErrors.Invalid(validation));
        }

        _ = RowVersions.TryParse(request.Version, out var version);
        _ = ShopClosureRequestValidator.TryParseDay(request.FirstDay, out var firstDay);
        DateOnly? lastDay = ShopClosureRequestValidator.TryParseDay(request.LastDay, out var last) ? last : null;
        try
        {
            return await unitOfWork.InTransactionAsync(
                token => AttemptAsync(id, version, firstDay, lastDay, request.Note, clock.Today, token),
                cancellationToken).ConfigureAwait(false);
        }
        catch (ConcurrencyConflictException)
        {
            return Result.Failure<ShopClosureDto>(EditErrors.Stale);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<ShopClosureDto>(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<ShopClosureDto>> AttemptAsync(
        Guid id, byte[] version, DateOnly firstDay, DateOnly? lastDay, string? note, DateOnly today, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var closure = await store.FindClosureAsync(id, cancellationToken).ConfigureAwait(false);
        if (closure is null)
        {
            return Result.Failure<ShopClosureDto>(ShopClosureErrors.NotFound);
        }

        if (!closure.RowVersion.AsSpan().SequenceEqual(version))
        {
            return Result.Failure<ShopClosureDto>(EditErrors.Stale);
        }

        var changed = closure.Change(firstDay, lastDay, note, today);
        if (changed.IsFailure)
        {
            return Result.Failure<ShopClosureDto>(changed.Error);
        }

        if (changed.Value is null)
        {
            return Result.Success(ShopClosureDto.From(closure));
        }

        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ShopClosureDto.From(closure));
    }
}
