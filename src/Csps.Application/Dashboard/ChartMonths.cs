using System.Globalization;
using Csps.Application.Ports;

namespace Csps.Application.Dashboard;

/// <summary>Builds the chart months from the four grouped sums: fills the gaps and works out income and profit (D-09, D-10, D-36).</summary>
public static class ChartMonths
{
    /// <summary>Builds one entry per month from <paramref name="firstMonth"/>, oldest first.</summary>
    /// <param name="firstMonth">Any day of the first month of the window.</param>
    /// <param name="months">How many months the window holds.</param>
    /// <param name="payments">The payment sums by month.</param>
    /// <param name="refunds">The refund sums by month.</param>
    /// <param name="companyExpenses">The company expense sums by month.</param>
    /// <param name="orderExpenses">The order expense sums by month.</param>
    /// <returns>The months, with zeros where a month has no rows. Profit is income minus expenses.</returns>
    public static IReadOnlyList<DashboardChartMonth> Build(
        DateOnly firstMonth,
        int months,
        IReadOnlyList<MonthSum> payments,
        IReadOnlyList<MonthSum> refunds,
        IReadOnlyList<MonthSum> companyExpenses,
        IReadOnlyList<MonthSum> orderExpenses)
    {
        ArgumentOutOfRangeException.ThrowIfNegativeOrZero(months);
        ArgumentNullException.ThrowIfNull(payments);
        ArgumentNullException.ThrowIfNull(refunds);
        ArgumentNullException.ThrowIfNull(companyExpenses);
        ArgumentNullException.ThrowIfNull(orderExpenses);

        var paid = Totals(payments);
        var refunded = Totals(refunds);
        var company = Totals(companyExpenses);
        var order = Totals(orderExpenses);

        var items = new List<DashboardChartMonth>(months);
        var month = new DateOnly(firstMonth.Year, firstMonth.Month, 1);
        for (var index = 0; index < months; index++)
        {
            var key = (month.Year, month.Month);
            var income = Of(paid, key) - Of(refunded, key);
            var expenses = Of(company, key) + Of(order, key);
            items.Add(new DashboardChartMonth(month.ToString("yyyy-MM", CultureInfo.InvariantCulture), income, expenses, income - expenses));
            month = month.AddMonths(1);
        }

        return items;
    }

    private static Dictionary<(int Year, int Month), decimal> Totals(IReadOnlyList<MonthSum> sums)
    {
        var totals = new Dictionary<(int Year, int Month), decimal>();
        foreach (var sum in sums)
        {
            var key = (sum.Year, sum.Month);
            totals[key] = Of(totals, key) + sum.Total;
        }

        return totals;
    }

    private static decimal Of(Dictionary<(int Year, int Month), decimal> totals, (int Year, int Month) key) =>
        totals.TryGetValue(key, out var total) ? total : 0.00m;
}
