using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;

namespace Csps.Application.Dashboard;

/// <summary>
/// Use case: staff of either role read the dashboard summary (DASH-01). One clock read gives the business today, the greeting part
/// and the period, so one answer is one consistent snapshot. The first name is read for the token's user, never from the request.
/// </summary>
/// <param name="reader">The dashboard read port.</param>
/// <param name="expenses">The company expense read port, for the expenses card.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="calendar">The business calendar.</param>
public sealed class GetDashboardSummaryHandler(IDashboardReader reader, ICompanyExpenseReader expenses, IRequestContext requestContext, IBusinessCalendar calendar)
{
    /// <summary>Reads the summary.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The summary, or a 401 when the token names no usable account.</returns>
    public async Task<Result<DashboardSummaryResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        if (requestContext.UserId is not { } callerId)
        {
            return Result.Failure<DashboardSummaryResponse>(AuthErrors.SessionEnded);
        }

        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var period = DashboardPeriod.From(clock);
        var figures = await reader.GetSummaryAsync(callerId, period, cancellationToken).ConfigureAwait(false);
        if (figures.FirstName is not { } firstName)
        {
            return Result.Failure<DashboardSummaryResponse>(AuthErrors.SessionEnded);
        }

        var (lastFirst, lastLast) = BusinessClock.MonthOf(period.MonthFirst.AddDays(-1));
        var totals = await expenses.GetKpisAsync(new KpiMonths(period.MonthFirst, period.MonthLast, lastFirst, lastLast), cancellationToken).ConfigureAwait(false);

        return Result.Success(new DashboardSummaryResponse(
            period.Today,
            GreetingOf(clock.DayPart),
            firstName,
            new DashboardOrderFigures(figures.ActiveOrders, figures.DueThisWeek, figures.Overdue, figures.Receivables),
            new DashboardCollectedFigures(
                figures.CollectedThisMonth,
                figures.CollectedComparison,
                period.ComparisonLast,
                ChangePercent(figures.CollectedThisMonth, figures.CollectedComparison)),
            new DashboardExpenseFigures(
                totals.ThisMonthTotal,
                totals.ThisMonthCount,
                totals.ThisMonthCount > 0 ? totals.TopCategory?.Name : null)));
    }

    // Whole-number change against the absolute comparison, half away from zero (D-06, D-54); null when there is nothing to compare.
    private static int? ChangePercent(decimal thisMonth, decimal comparison)
    {
        if (comparison == 0m)
        {
            return null;
        }

        var percent = Math.Round((thisMonth - comparison) / Math.Abs(comparison) * 100m, 0, MidpointRounding.AwayFromZero);
        return (int)Math.Clamp(percent, int.MinValue, int.MaxValue);
    }

    private static string GreetingOf(DayPart part) => part switch
    {
        DayPart.Morning => "morning",
        DayPart.Afternoon => "afternoon",
        _ => "evening",
    };
}
