using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// One idempotent step of the dev seed (FND-04, D-30). Steps run in ascending <see cref="Order"/>; each one
/// brings its own data to the seed state and reports whether it changed anything. Phase 1 has only the
/// SiteSettings step; later phases append users, expenses, orders and price-list steps.
/// </summary>
public interface ISeedStep
{
    /// <summary>Position in the run; unique across all steps. Lower runs first.</summary>
    int Order { get; }

    /// <summary>Short display name printed by the dev-seed command.</summary>
    string Name { get; }

    /// <summary>Brings this step's data to the seed state. The runner saves the context afterwards.</summary>
    /// <param name="db">The context to change.</param>
    /// <param name="time">The clock used for audit stamps.</param>
    /// <param name="cancellationToken">Cancels the step.</param>
    /// <returns>True when the step added or changed anything; false when the data already matched.</returns>
    Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken);
}
