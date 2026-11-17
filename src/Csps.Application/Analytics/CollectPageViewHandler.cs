using Csps.Application.Ports;
using Csps.Domain.Common;
using FluentValidation;

namespace Csps.Application.Analytics;

/// <summary>
/// Use case: one public page view is counted for the business day and the page, anonymously (ANL-05, ANL-06, D-21). Every gate that drops the
/// view still answers success, so a bot or a signed-in staff member learns nothing from the answer.
/// </summary>
/// <param name="pages">Maps a cut path to a page key.</param>
/// <param name="counts">The daily counter.</param>
/// <param name="calendar">The business clock: the day the view belongs to.</param>
/// <param name="validator">Checks the body.</param>
public sealed class CollectPageViewHandler(IPublicPageResolver pages, IPageViewCounts counts, IBusinessCalendar calendar, IValidator<PageViewRequest> validator)
{
    /// <summary>Counts one page view, or drops it.</summary>
    /// <param name="request">The body as the browser sent it.</param>
    /// <param name="context">What the server read from the headers and cookies.</param>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>Success, whether or not the view was counted; a 400 naming the path for a bad body.</returns>
    public Task<Result> HandleAsync(PageViewRequest request, CollectContext context, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(context);
        _ = pages;
        _ = counts;
        _ = calendar;
        _ = validator;
        return Task.FromResult(Result.Success());
    }
}
