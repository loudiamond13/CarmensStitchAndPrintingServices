using System.Security.Cryptography.X509Certificates;
using Microsoft.Extensions.Hosting;

namespace Csps.Infrastructure.DataProtection;

/// <summary>
/// Owns the certificates Data Protection keeps for the life of the app. It is a hosted service only so the host
/// resolves it at start and disposes it on shutdown; disposing a certificate deletes its machine key file.
/// </summary>
internal sealed class DataProtectionCertificates : IHostedService, IDisposable
{
    private readonly X509Certificate2[] _certificates;
    private bool _disposed;

    /// <summary>Takes ownership of <paramref name="certificates"/>.</summary>
    /// <param name="certificates">The current certificate first, then any previous ones.</param>
    public DataProtectionCertificates(X509Certificate2[] certificates)
    {
        ArgumentNullException.ThrowIfNull(certificates);
        _certificates = certificates;
    }

    /// <summary>Gets the owned certificates.</summary>
    public IReadOnlyList<X509Certificate2> Certificates => _certificates;

    /// <inheritdoc />
    public Task StartAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>Does nothing: requests still in flight may need the keys until the host disposes this.</summary>
    /// <param name="cancellationToken">Not used.</param>
    /// <returns>A completed task.</returns>
    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>Disposes every certificate once, which removes its machine key.</summary>
    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        foreach (var certificate in _certificates)
        {
            certificate.Dispose();
        }
    }
}
