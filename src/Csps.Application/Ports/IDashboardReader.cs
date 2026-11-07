using Csps.Application.Dashboard;

namespace Csps.Application.Ports;

/// <summary>Untracked reads of the shop-wide dashboard figures. Every figure is an aggregate; nothing is cached (D-13).</summary>
public interface IDashboardReader
{
    /// <summary>Reads the caller's first name and the order and money figures for the period.</summary>
    /// <param name="callerId">The signed-in user, from the token.</param>
    /// <param name="period">The business dates to judge the figures against.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The figures.</returns>
    Task<DashboardFigures> GetSummaryAsync(Guid callerId, DashboardPeriod period, CancellationToken cancellationToken);

    /// <summary>Reads the money sums per business month for the chart: payments, refunds, company expenses and order expenses.</summary>
    /// <param name="firstDay">The first day of the window.</param>
    /// <param name="lastDay">The last day of the window.</param>
    /// <param name="cancellationToken">Cancels the read.</param>
    /// <returns>The four lists; a month with no rows is absent from its list.</returns>
    Task<DashboardMonthSums> GetMonthSumsAsync(DateOnly firstDay, DateOnly lastDay, CancellationToken cancellationToken);
}

/// <summary>The total of one money source in one business month.</summary>
/// <param name="Year">The calendar year.</param>
/// <param name="Month">The calendar month, 1 to 12.</param>
/// <param name="Total">The sum of the amounts dated in that month.</param>
public sealed record MonthSum(int Year, int Month, decimal Total);

/// <summary>The four sums the chart is built from, each placed by its own date and none holding a deleted row.</summary>
/// <param name="Payments">Order payments by payment date.</param>
/// <param name="Refunds">Order refunds by refund date.</param>
/// <param name="CompanyExpenses">Company expenses by expense date.</param>
/// <param name="OrderExpenses">Order expenses by expense date.</param>
public sealed record DashboardMonthSums(
    IReadOnlyList<MonthSum> Payments,
    IReadOnlyList<MonthSum> Refunds,
    IReadOnlyList<MonthSum> CompanyExpenses,
    IReadOnlyList<MonthSum> OrderExpenses);

/// <summary>The dashboard figures the read port returns.</summary>
/// <param name="FirstName">The caller's first name; null when no user row has that id.</param>
/// <param name="ActiveOrders">Orders in Pending to Delivered that are not deleted.</param>
/// <param name="DueThisWeek">Active orders due in the business week that are not overdue.</param>
/// <param name="Overdue">Pending, Mockup, In Production and Ready orders due before today.</param>
/// <param name="Receivables">The sum of the positive balances of the active orders.</param>
/// <param name="CollectedThisMonth">Payments minus refunds dated in this business month, on orders that are not deleted.</param>
/// <param name="CollectedComparison">The same figure for the comparison dates of the period.</param>
/// <param name="Statuses">The order count of each status the bar shows.</param>
public sealed record DashboardFigures(
    string? FirstName,
    int ActiveOrders,
    int DueThisWeek,
    int Overdue,
    decimal Receivables,
    decimal CollectedThisMonth,
    decimal CollectedComparison,
    DashboardStatusCounts Statuses);

/// <summary>The order counts per status for the bar. Cancelled orders have no entry.</summary>
/// <param name="Pending">Orders now in Pending.</param>
/// <param name="Mockup">Orders now in Mockup.</param>
/// <param name="Production">Orders now in In Production.</param>
/// <param name="Ready">Orders now in Ready.</param>
/// <param name="Delivered">Orders now in Delivered.</param>
/// <param name="CompletedThisMonth">Orders moved to Completed inside the period's business month.</param>
public sealed record DashboardStatusCounts(int Pending, int Mockup, int Production, int Ready, int Delivered, int CompletedThisMonth);
