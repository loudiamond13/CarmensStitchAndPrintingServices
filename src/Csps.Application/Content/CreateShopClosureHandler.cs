using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager adds a closure (CONT-04, D-21). The form is checked first (400), then one transaction takes the site-content
/// lock and saves the closure. Who added it and when come from the token and the clock (SEC-08). A save that loses a deadlock is a 409
/// and is not retried by this handler beyond one more pass.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateShopClosureHandler(
    ISiteContentStore store,
    ISiteContentLock siteLock,
    IUnitOfWork unitOfWork,
    IBusinessCalendar calendar,
    TimeProvider time,
    IValidator<ShopClosureRequest> validator)
{
    /// <summary>Adds the closure.</summary>
    /// <param name="request">The form.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The new closure, a 400 naming every field that failed, or a 409 when the save lost a race.</returns>
    public async Task<Result<ShopClosureDto>> HandleAsync(ShopClosureRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var context = new ValidationContext<ShopClosureRequest>(request);
        context.RootContextData[ShopClosureRequestValidator.TodayKey] = clock.Today;
        var validation = await validator.ValidateAsync(context, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure<ShopClosureDto>(SiteContentErrors.Invalid(validation));
        }

        _ = ShopClosureRequestValidator.TryParseDay(request.FirstDay, out var firstDay);
        DateOnly? lastDay = ShopClosureRequestValidator.TryParseDay(request.LastDay, out var last) ? last : null;
        try
        {
            return await ConflictRetry
                .RunAsync(
                    () => unitOfWork.InTransactionAsync(token => AttemptAsync(firstDay, lastDay, request.Note, clock.Today, token), cancellationToken),
                    Result.Failure<ShopClosureDto>(AuthErrors.SessionBusy))
                .ConfigureAwait(false);
        }
        catch (SiteContentBusyException)
        {
            return Result.Failure<ShopClosureDto>(AuthErrors.SessionBusy);
        }
    }

    private async Task<Result<ShopClosureDto>> AttemptAsync(DateOnly firstDay, DateOnly? lastDay, string? note, DateOnly today, CancellationToken cancellationToken)
    {
        await siteLock.TakeAsync(cancellationToken).ConfigureAwait(false);
        var created = ShopClosure.Create(firstDay, lastDay, note, today, time.GetUtcNow());
        if (created.IsFailure)
        {
            return Result.Failure<ShopClosureDto>(created.Error);
        }

        var closure = created.Value;
        store.AddClosure(closure);
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ShopClosureDto.From(closure));
    }
}
