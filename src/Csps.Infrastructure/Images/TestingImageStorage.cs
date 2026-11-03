#if CSPS_TESTING
namespace Csps.Infrastructure.Images;

/// <summary>One upload the Testing storage received.</summary>
/// <param name="PublicId">The public id the file was stored under.</param>
/// <param name="AssetFolder">The asset folder.</param>
/// <param name="Length">The number of bytes.</param>
public sealed record RecordedImageUpload(string PublicId, string AssetFolder, int Length);

/// <summary>The Testing environment's image storage (D-07): keeps nothing yet.</summary>
public sealed class TestingImageStorage
{
    /// <summary>Gets the uploads received.</summary>
    public IReadOnlyList<RecordedImageUpload> Uploads { get; } = [];
}
#endif
