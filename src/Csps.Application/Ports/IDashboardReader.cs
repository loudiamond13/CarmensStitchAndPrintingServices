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
}

/// <summary>The dashboard figures the read port returns.</summary>
/// <param name="FirstName">The caller's first name; null when no user row has that id.</param>
/// <param name="ActiveOrders">Orders in Pending to Delivered that are not deleted.</param>
/// <param name="DueThisWeek">Active orders due in the business week that are not overdue.</param>
/// <param name="Overdue">Pending, Mockup, In Production and Ready orders due before today.</param>
/// <param name="Receivables">The sum of the positive balances of the active orders.</param>
/// <param name="CollectedThisMonth">Payments minus refunds dated in this business month, on orders that are not deleted.</param>
/// <param name="CollectedComparison">The same figure for the comparison dates of the period.</param>
public sealed record DashboardFigures(
    string? FirstName,
    int ActiveOrders,
    int DueThisWeek,
    int Overdue,
    decimal Receivables,
    decimal CollectedThisMonth,
    decimal CollectedComparison);
