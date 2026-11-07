namespace Csps.Application.Dashboard;

/// <summary>The order figures of the dashboard cards.</summary>
/// <param name="Active">Orders in Pending, Mockup, In Production, Ready or Delivered; deleted orders never count.</param>
public sealed record DashboardOrderFigures(int Active);

/// <summary>Everything the dashboard shows except the chart (DASH-01). Both roles get the same figures; only the name and greeting part can differ.</summary>
/// <param name="Today">The business today, so the browser never reads the device clock for it.</param>
/// <param name="Greeting">The part of the business day: <c>morning</c>, <c>afternoon</c> or <c>evening</c>.</param>
/// <param name="FirstName">The signed-in person's first name.</param>
/// <param name="Orders">The order figures.</param>
public sealed record DashboardSummaryResponse(DateOnly Today, string Greeting, string FirstName, DashboardOrderFigures Orders);
