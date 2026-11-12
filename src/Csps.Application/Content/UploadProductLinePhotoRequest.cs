using Csps.Domain.Content;

namespace Csps.Application.Content;

/// <summary>A line photo upload as the server received it: the file bytes held in memory, never on disk (D-02, IMG-02).</summary>
/// <param name="LineId">The product line the photo is for.</param>
/// <param name="Slot">The place on the line: main, back or fabric.</param>
/// <param name="Bytes">The whole file; empty when no file was sent.</param>
/// <param name="FileName">The name the client gave the file; only used in an error message.</param>
public sealed record UploadProductLinePhotoRequest(Guid LineId, ProductLinePhotoSlot Slot, ReadOnlyMemory<byte> Bytes, string? FileName);
