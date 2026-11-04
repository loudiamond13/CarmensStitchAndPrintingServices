using Csps.Application.Ports;
using Csps.Infrastructure.Persistence;

namespace Csps.Infrastructure.Images;

/// <summary>
/// Reads which stored photo files the database knows (JOB-02, D-23). The photo query lifts the named SoftDelete filter, so a photo of a
/// soft-deleted order still counts: the order can be restored and a Cloudinary removal cannot be undone.
/// </summary>
/// <param name="context">The database context.</param>
internal sealed class ImageInventory(CspsDbContext context) : IImageInventory
{
    /// <inheritdoc />
    public Task<IReadOnlySet<string>> KnownAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken)
    {
        _ = context;
        return Task.FromResult<IReadOnlySet<string>>(new HashSet<string>(StringComparer.OrdinalIgnoreCase));
    }

    /// <inheritdoc />
    public Task<IReadOnlySet<string>> NamedByPhotosAsync(IReadOnlyCollection<string> publicIds, CancellationToken cancellationToken) =>
        Task.FromResult<IReadOnlySet<string>>(new HashSet<string>(StringComparer.OrdinalIgnoreCase));
}
