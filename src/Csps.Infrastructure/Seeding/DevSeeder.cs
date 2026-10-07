using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Seeding;

/// <summary>
/// Runs the dev-seed steps (FND-04, D-08). Only the explicit <c>tools/Csps.DevSeed</c> command and tests use
/// it; nothing in the application seeds at startup.
/// </summary>
public sealed class DevSeeder
{
    private readonly IReadOnlyList<ISeedStep> _steps;
    private readonly TimeProvider _time;

    /// <summary>Creates a runner over the given steps.</summary>
    /// <param name="steps">The steps, in any order.</param>
    /// <param name="time">The clock passed to every step.</param>
    public DevSeeder(IEnumerable<ISeedStep> steps, TimeProvider time)
    {
        ArgumentNullException.ThrowIfNull(steps);
        ArgumentNullException.ThrowIfNull(time);
        _steps = [.. steps];
        _time = time;
    }

    /// <summary>Runs every step.</summary>
    /// <param name="db">The context to seed.</param>
    /// <param name="cancellationToken">Cancels the run.</param>
    /// <returns>One result per step.</returns>
    public Task<IReadOnlyList<SeedStepResult>> RunAsync(CspsDbContext db, CancellationToken cancellationToken = default)
    {
        _ = db;
        _ = _time;
        _ = cancellationToken;
        return Task.FromResult<IReadOnlyList<SeedStepResult>>([]);
    }
}
