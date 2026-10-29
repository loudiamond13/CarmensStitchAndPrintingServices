using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Seeding;

/// <summary>Adds the UI-spec orders to an empty Orders table (ORD-20). Not built yet.</summary>
public sealed class OrdersSeedStep : ISeedStep
{
    /// <inheritdoc />
    public int Order => 400;

    /// <inheritdoc />
    public string Name => "Orders";

    /// <inheritdoc />
    public Task<bool> RunAsync(CspsDbContext db, TimeProvider time, CancellationToken cancellationToken) => Task.FromResult(false);
}
