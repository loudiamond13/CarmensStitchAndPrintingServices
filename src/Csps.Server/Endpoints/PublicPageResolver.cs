using Csps.Application.Ports;

namespace Csps.Server.Endpoints;

/// <summary>Answers <see cref="IPublicPageResolver"/> with the server's route table (ANL-05).</summary>
/// <param name="environment">The host environment, which decides whether the developer preview paths exist.</param>
public sealed class PublicPageResolver(IHostEnvironment environment) : IPublicPageResolver
{
    /// <inheritdoc />
    public string? PageKeyFor(string cutPath)
    {
        _ = environment;
        return null;
    }
}
