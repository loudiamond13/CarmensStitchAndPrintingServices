namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Every dev-seed step, in run order (D-30). The phases that create users, orders and the price list append their
/// steps here; Phase 6 added the company expenses and Phase 7 the orders.
/// </summary>
public static class DevSeedSteps
{
    /// <summary>All steps the dev-seed command runs.</summary>
    public static IReadOnlyList<ISeedStep> All { get; } = [new SiteSettingsSeedStep(), new CompanyExpensesSeedStep(), new OrdersSeedStep()];
}
