using Csps.Application.Ports;

namespace Csps.Testing;

/// <summary>
/// Test-only <see cref="ISessionCache"/> for hosts without a database: every session is active. The real cache is
/// proven against a real database by <c>SessionRevocationTests</c>.
/// </summary>
internal sealed class AcceptingSessionCache : ISessionCache
{
    public ValueTask<bool> IsActiveAsync(Guid sessionId, Guid userId, CancellationToken cancellationToken) => ValueTask.FromResult(true);

    public ValueTask EvictAsync(Guid sessionId, CancellationToken cancellationToken) => ValueTask.CompletedTask;

    public ValueTask EvictUserAsync(Guid userId, CancellationToken cancellationToken) => ValueTask.CompletedTask;
}
