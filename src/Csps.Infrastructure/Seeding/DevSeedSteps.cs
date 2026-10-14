namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Every dev-seed step, in run order (D-30). Phase 1 ships only the SiteSettings step; the phases that create
/// users, company expenses, orders and the price list append their steps here.
/// </summary>
public static class DevSeedSteps
{
    /// <summary>All steps the dev-seed command runs.</summary>
    public static IReadOnlyList<ISeedStep> All { get; } = [new SiteSettingsSeedStep()];
}
