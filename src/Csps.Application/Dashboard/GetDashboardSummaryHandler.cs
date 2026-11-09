using Csps.Application.Auth;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Domain.Time;

namespace Csps.Application.Dashboard;

/// <summary>
/// Use case: staff of either role read the dashboard summary (DASH-01). One clock read gives the business today, the greeting part
/// and the period, so one answer is one consistent snapshot. The first name is read for the token's user, never from the request.
/// </summary>
/// <param name="reader">The dashboard read port.</param>
/// <param name="orders">The order read port, for the newest orders.</param>
/// <param name="expenses">The company expense read port, for the expenses card.</param>
/// <param name="imageDelivery">Builds the cover addresses of the newest orders.</param>
/// <param name="requestContext">The signed-in user.</param>
/// <param name="calendar">The business calendar.</param>
public sealed class GetDashboardSummaryHandler(
    IDashboardReader reader,
    IOrderReader orders,
    ICompanyExpenseReader expenses,
    IImageDelivery imageDelivery,
    IRequestContext requestContext,
    IBusinessCalendar calendar)
{
    private const int RecentOrderCount = 6;

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
        var newest = await orders.ListNewestAsync(RecentOrderCount, cancellationToken).ConfigureAwait(false);

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
                totals.ThisMonthTotal > 0m ? totals.TopCategory?.Name : null),
            StatusesOf(figures.Statuses),
            [.. newest.Select(row => OrderListEntries.From(row, imageDelivery))]));
    }

    // The six shown statuses in a fixed order, keyed as the order list keys them.
    private static IReadOnlyList<DashboardStatusCount> StatusesOf(DashboardStatusCounts counts) =>
    [
        new(OrderStatusNames.ToKey(OrderStatus.Pending), counts.Pending),
        new(OrderStatusNames.ToKey(OrderStatus.Mockup), counts.Mockup),
        new(OrderStatusNames.ToKey(OrderStatus.InProduction), counts.Production),
        new(OrderStatusNames.ToKey(OrderStatus.Ready), counts.Ready),
        new(OrderStatusNames.ToKey(OrderStatus.Delivered), counts.Delivered),
        new(OrderStatusNames.ToKey(OrderStatus.Completed), counts.CompletedThisMonth),
    ];

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

    /// <summary>Names the greeting for a part of the day.</summary>
    /// <param name="part">The part of the business day.</param>
    /// <returns>"morning", "afternoon" or "evening".</returns>
    /// <exception cref="ArgumentOutOfRangeException">The part is not one of the three.</exception>
    public static string GreetingOf(DayPart part) => part switch
    {
        DayPart.Morning => "morning",
        DayPart.Afternoon => "afternoon",
        DayPart.Evening => "evening",
        _ => throw new ArgumentOutOfRangeException(nameof(part), part, "Unknown part of the day."),
    };
}
