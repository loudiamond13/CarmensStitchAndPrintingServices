using Csps.Domain.QuoteRequests;

namespace Csps.Application.Ports;

/// <summary>
/// What an upload needs to know about a quote request: its status, the hash and end time of its upload key, and the declared places
/// that still wait for a photo (INQ-02).
/// </summary>
/// <param name="Id">The request id.</param>
/// <param name="Status">The request status; a Spam request takes no photo.</param>
/// <param name="UploadKeyHash">The SHA-256 of the upload key; null when no photo was declared.</param>
/// <param name="UploadKeyExpiresAtUtc">When the key stops working; null when no photo was declared.</param>
/// <param name="EmptySlots">The declared places that have no photo yet.</param>
public sealed record QuotePhotoTarget(
    Guid Id,
    QuoteRequestStatus Status,
    byte[]? UploadKeyHash,
    DateTimeOffset? UploadKeyExpiresAtUtc,
    IReadOnlyList<int> EmptySlots);

/// <summary>The facts of a photo that reached storage, written to its place.</summary>
/// <param name="PublicId">The storage id.</param>
/// <param name="Width">The upright width in pixels.</param>
/// <param name="Height">The upright height in pixels.</param>
/// <param name="Bytes">The stored size in bytes.</param>
/// <param name="Kind">The format key.</param>
/// <param name="StoredAtUtc">When the file was stored.</param>
public sealed record QuotePhotoStored(string PublicId, int Width, int Height, int Bytes, string Kind, DateTimeOffset StoredAtUtc);
