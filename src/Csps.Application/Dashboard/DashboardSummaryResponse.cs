namespace Csps.Application.Dashboard;

/// <summary>The order figures of the dashboard cards.</summary>
/// <param name="Active">Orders in Pending, Mockup, In Production, Ready or Delivered; deleted orders never count.</param>
/// <param name="DueThisWeek">Active orders due Monday to Sunday of the business week that are not overdue; an order with no due date counts in neither this nor <paramref name="Overdue"/>.</param>
/// <param name="Overdue">Pending, Mockup, In Production and Ready orders due before the business today.</param>
/// <param name="Receivables">The sum over all active orders, overdue ones included, of the balance when it is above zero, else zero.</param>
public sealed record DashboardOrderFigures(int Active, int DueThisWeek, int Overdue, decimal Receivables);

/// <summary>The money collected this month and the comparison.</summary>
/// <param name="ThisMonth">Payments dated in this business month minus refunds dated in it; Cancelled orders included, deleted orders excluded; may be below zero.</param>
/// <param name="Comparison">The same figure for the first of last month through the same day number last month.</param>
/// <param name="ComparisonThrough">The last day of the comparison.</param>
/// <param name="ChangePercent">The whole-number change against the absolute value of the comparison, rounded away from zero; null when the comparison is 0.00.</param>
public sealed record DashboardCollectedFigures(decimal ThisMonth, decimal Comparison, DateOnly ComparisonThrough, int? ChangePercent);

/// <summary>The company expense figures of the dashboard card.</summary>
/// <param name="ThisMonth">The sum of this month's company expenses.</param>
/// <param name="Count">How many company expenses this month holds.</param>
/// <param name="TopCategory">The name of the category with the most money this month, ties to the alphabetically first name; null with no expenses.</param>
public sealed record DashboardExpenseFigures(decimal ThisMonth, int Count, string? TopCategory);

/// <summary>Everything the dashboard shows except the chart (DASH-01). Both roles get the same figures; only the name and greeting part can differ.</summary>
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
/// <param name="Greeting">The part of the business day: <c>morning</c>, <c>afternoon</c> or <c>evening</c>.</param>
/// <param name="FirstName">The signed-in person's first name.</param>
/// <param name="Orders">The order figures.</param>
/// <param name="Collected">The money collected this month.</param>
/// <param name="Expenses">The company expenses this month.</param>
public sealed record DashboardSummaryResponse(
    DateOnly Today,
    string Greeting,
    string FirstName,
    DashboardOrderFigures Orders,
    DashboardCollectedFigures Collected,
    DashboardExpenseFigures Expenses);
