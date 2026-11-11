namespace Csps.Application.Dashboard;

/// <summary>One month of the dashboard chart. Every figure is worked out on the server.</summary>
/// <param name="Month">The business month as <c>yyyy-MM</c>.</param>
/// <param name="Income">Payments dated in the month minus refunds dated in it, on orders that are not deleted; Cancelled orders count; may be below zero (D-09, D-11).</param>
/// <param name="Expenses">Company expenses plus order expenses, each placed by its own expense date; deleted ones never count (D-10, D-11).</param>
/// <param name="Profit"><paramref name="Income"/> minus <paramref name="Expenses"/> (D-36).</param>
public sealed record DashboardChartMonth(string Month, decimal Income, decimal Expenses, decimal Profit);

/// <summary>The money-over-time chart of the dashboard (DASH-03).</summary>
/// <param name="Months">How many months the window holds: 6 or 12.</param>
/// <param name="Items">Exactly <paramref name="Months"/> entries, oldest first, the current business month last. A month with no money is still listed, with zeros.</param>
public sealed record DashboardChartResponse(int Months, IReadOnlyList<DashboardChartMonth> Items);
