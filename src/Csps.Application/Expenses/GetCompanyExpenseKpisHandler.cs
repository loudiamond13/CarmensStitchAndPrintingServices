using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Time;

namespace Csps.Application.Expenses;

/// <summary>
/// Use case: staff of either role read the month KPIs (CEXP-03, D-25). "This month" is the month of the business today, so it
/// turns over at midnight in the business zone and never by the server's or the device's own clock (D-24). Expenses count by their
/// date; the reader leaves out deleted ones (D-01).
/// </summary>
public sealed class GetCompanyExpenseKpisHandler(ICompanyExpenseReader reader, IBusinessCalendar calendar)
{
    /// <summary>Reads this month, last month and this month's top category.</summary>
    /// <param name="cancellationToken">Cancels the work.</param>
    /// <returns>The KPIs.</returns>
    public async Task<Result<CompanyExpenseKpisResponse>> HandleAsync(CancellationToken cancellationToken)
    {
        var clock = await calendar.GetClockAsync(cancellationToken).ConfigureAwait(false);
        var today = clock.Today;
        var (thisFirst, thisLast) = BusinessClock.MonthOf(today);
        var (lastFirst, lastLast) = BusinessClock.MonthOf(thisFirst.AddDays(-1));

        var totals = await reader.GetKpisAsync(new KpiMonths(thisFirst, thisLast, lastFirst, lastLast), cancellationToken).ConfigureAwait(false);

        TopCategoryKpi? top = null;
        if (totals.TopCategory is { } category && totals.ThisMonthTotal > 0m)
        {
            var share = (int)Math.Round(totals.TopTotal / totals.ThisMonthTotal * 100m, 0, MidpointRounding.AwayFromZero);
            top = new TopCategoryKpi(category, totals.TopTotal, share);
        }

        return Result.Success(new CompanyExpenseKpisResponse(
            today,
            new MonthKpi(thisFirst, totals.ThisMonthTotal, totals.ThisMonthCount),
            new MonthKpi(lastFirst, totals.LastMonthTotal, totals.LastMonthCount),
            top));
    }
}
