using Csps.Application.Auth;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Content;
using FluentValidation;

namespace Csps.Application.Content;

/// <summary>
/// Use case: a Manager adds a closure (CONT-04, D-21). The form is checked first (400), then one transaction takes the site-content
/// lock, checks that no stored closure shares a day with the new one (a 400 on the first day, naming the first shared day) and saves
/// the closure with its <c>shop-closure.added</c> audit entry. The lock makes two Managers adding overlapping closures at once end
/// with one stored closure and one refusal. Who added it and when come from the token and the clock (SEC-08). A save that loses a
/// deadlock is read again once and is a 409 if it loses again.
/// </summary>
/// <param name="store">The site content store.</param>
/// <param name="siteLock">The site-content lock.</param>
/// <param name="audit">The audit trail.</param>
/// <param name="unitOfWork">The unit of work that saves the change.</param>
/// <param name="calendar">The business calendar.</param>
/// <param name="time">The clock.</param>
/// <param name="validator">The form rules.</param>
public sealed class CreateShopClosureHandler(
    ISiteContentStore store,
    ISiteContentLock siteLock,
    IAuditTrail audit,
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
        var overlapping = await store.FindOverlappingClosureAsync(closure.FirstDay, closure.LastDay, null, cancellationToken).ConfigureAwait(false);
        if (overlapping is not null)
        {
            return Result.Failure<ShopClosureDto>(ShopClosureErrors.Overlap(closure.FirstSharedDay(overlapping)!.Value));
        }

        store.AddClosure(closure);
        audit.Record(AuditActions.ShopClosureAdded, ShopClosureAuditDetail.TargetType, AuditKey.Of(closure.Id), ShopClosureAuditDetail.Added(closure));
        await unitOfWork.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return Result.Success(ShopClosureDto.From(closure));
    }
}
