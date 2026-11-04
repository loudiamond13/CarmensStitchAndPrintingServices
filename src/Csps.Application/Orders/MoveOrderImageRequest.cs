namespace Csps.Application.Orders;

/// <summary>
/// Moves one photo of a saved order to a place (ORD-04, D-13, D-14). Place 0 is the cover, so "Make Cover" is the same request with
/// place 0. It carries the order's version as the page was opened. Any other member in the body is ignored.
/// </summary>
/// <param name="Position">The place to move the photo to, counting from 0.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the page was opened with.</param>
public sealed record MoveOrderImageRequest(int? Position, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static MoveOrderImageRequest Empty { get; } = new(null, null);
}
