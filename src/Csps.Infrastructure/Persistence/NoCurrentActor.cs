using Csps.Application.Ports;

namespace Csps.Infrastructure.Persistence;

/// <summary>The default <see cref="ICurrentActor"/> for hosts with no signed-in user (tests, tools): every write is System.</summary>
internal sealed class NoCurrentActor : ICurrentActor
{
    /// <inheritdoc />
    public Guid? UserId => null;
}
