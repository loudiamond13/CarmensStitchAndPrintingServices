using Csps.Domain.Analytics;
using Csps.Domain.Content;

namespace Csps.Application.Analytics;

/// <summary>
/// The three server gates for the identified half of collection (ANL-05, T-12-39): the HttpOnly visitor id is present, the consent cookie allows
/// stats for the current policy version and is current today, and the browser did not send <c>Sec-GPC: 1</c>. Page views and speed samples
/// use the same rule.
/// </summary>
internal static class IdentifiedCollection
{
    /// <summary>Tells whether the call may be recorded against a visit.</summary>
    /// <param name="context">What the server read from the headers and cookies.</param>
    /// <param name="today">The business day.</param>
    /// <returns>True when all three gates are open.</returns>
    public static bool IsAllowed(CollectContext context, DateOnly today) =>
        !context.Gpc
        && !string.IsNullOrEmpty(context.VisitorToken)
        && ConsentCookie.TryParse(context.ConsentCookie, out var cookie)
        && cookie.AllowsStats(LegalPages.CookiePolicyVersion, today);
}
