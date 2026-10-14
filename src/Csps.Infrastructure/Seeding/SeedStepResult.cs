namespace Csps.Infrastructure.Seeding;

/// <summary>The outcome of one seed step.</summary>
/// <param name="Order">The step's <see cref="ISeedStep.Order"/>.</param>
/// <param name="Name">The step's <see cref="ISeedStep.Name"/>.</param>
/// <param name="Changed">Whether the step added or changed anything.</param>
public sealed record SeedStepResult(int Order, string Name, bool Changed);
