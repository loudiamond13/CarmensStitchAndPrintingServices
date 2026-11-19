using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Domain.Analytics;
using Csps.Domain.Auditing;
using Csps.Domain.Common;
using Csps.Domain.Time;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: one public page view is counted for the business day and the page, anonymously (ANL-05, ANL-06, D-21). Every gate that drops the
/// view still answers success, so a bot or a signed-in staff member learns nothing from the answer. Nothing else is stored: no visit, visitor id or
/// referrer (ANL-05, D-53).
/// </summary>
/// <param name="pages">Maps a cut path to a page key.</param>
/// <param name="counts">The daily counter.</param>
/// <param name="calendar">The business clock: the day the view belongs to.</param>
/// <param name="validator">Checks the body.</param>
public sealed class CollectPageViewHandler(
    IPublicPageResolver pages,
    IPageViewCounts counts,
    IBusinessCalendar calendar,
    IValidator<PageViewRequest> validator)
{
    /// <summary>Counts one page view, or drops it.</summary>
    /// <param name="request">The body as the browser sent it.</param>
    /// <param name="context">What the server read from the headers and cookies.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, whether or not the view was counted; a 400 naming the path for a bad body.</returns>
    public async Task<Result> HandleAsync(PageViewRequest request, CollectContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(context);

        var validation = await validator.ValidateAsync(request, cancellationToken).ConfigureAwait(false);
        if (!validation.IsValid)
        {
            return Result.Failure(ValidationResults.ToError(validation, PageViewErrors.ValidationCode, PageViewErrors.ValidationMessage));
        }

        // A crawler, a test runner or a call with no User-Agent is not a visitor.
        if (AnalyticsBots.IsBot(context.UserAgent))
        {
            return Result.Success();
        }

        // Signed-in staff browsing the public site are not visitors, not even in the anonymous count (D-21).
        if (context.IsStaff)
        {
            return Result.Success();
        }

        // Only the pathname is kept: the query and the fragment are cut before anything else reads the path.
        if (AnalyticsPath.Cut(request.Path) is not { } cutPath || pages.PageKeyFor(cutPath) is not { } pageKey)
        {
            return Result.Success();
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        await counts.IncrementAsync(clock.Today, pageKey, cancellationToken).ConfigureAwait(false);
        return Result.Success();
    }
}
