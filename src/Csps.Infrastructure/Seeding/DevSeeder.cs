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

    /// <summary>
    /// Runs every step in ascending <see cref="ISeedStep.Order"/> and saves after each one. Fails before any
    /// step runs when two steps share an order, so the run order is always fully specified.
    /// </summary>
    /// <param name="db">The context to seed.</param>
    /// <param name="cancellationToken">Cancels the run.</param>
    /// <returns>One result per step, in run order.</returns>
    /// <exception cref="InvalidOperationException">Two steps share an order.</exception>
    public async Task<IReadOnlyList<SeedStepResult>> RunAsync(CspsDbContext db, CancellationToken cancellationToken = default)
    {
        ArgumentNullException.ThrowIfNull(db);

        var duplicate = _steps.GroupBy(step => step.Order).FirstOrDefault(group => group.Skip(1).Any());
        if (duplicate is not null)
        {
            throw new InvalidOperationException(
                $"Seed steps {string.Join(", ", duplicate.Select(step => step.Name))} share Order {duplicate.Key}. Every step needs its own Order.");
        }

        var results = new List<SeedStepResult>(_steps.Count);
        foreach (var step in _steps.OrderBy(step => step.Order))
        {
            var changed = await step.RunAsync(db, _time, cancellationToken).ConfigureAwait(false);
            await db.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
            results.Add(new SeedStepResult(step.Order, step.Name, changed));
        }

        return results;
    }
}
