using Csps.Application.Ports;

namespace Csps.Application.UnitTests.Maintenance;

/// <summary>An in-memory inventory: some ids are named by photo rows, some only held by removal rows.</summary>
internal sealed class FakeImageInventory : IImageInventory
{
    public HashSet<string> Photos { get; } = new(StringComparer.OrdinalIgnoreCase);

    public HashSet<string> Queued { get; } = new(StringComparer.OrdinalIgnoreCase);

    /// <summary>Gets the ids each call was asked about, so a test can see that only candidates are checked.</summary>
    public List<IReadOnlyCollection<string>> Asked { get; } = [];

    public Task<IReadOnlySet<string>> KnownAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken)
    {
        Asked.Add(publicIds);
        return Task.FromResult<IReadOnlySet<string>>(publicIds.Where(id => Photos.Contains(id) || Queued.Contains(id)).ToHashSet(StringComparer.OrdinalIgnoreCase));
    }

    public Task<IReadOnlySet<string>> NamedByPhotosAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlySet<string>>(publicIds.Where(Photos.Contains).ToHashSet(StringComparer.OrdinalIgnoreCase));
}
