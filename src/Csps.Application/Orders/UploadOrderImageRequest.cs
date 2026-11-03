namespace Csps.Application.Orders;

/// <summary>A photo upload as the server received it: the file bytes held in memory, never on disk (IMG-02).</summary>
/// <param name="Bytes">The whole file; empty when no file was sent.</param>
/// <param name="FileName">The name the client gave the file; only used in an error message.</param>
/// <param name="Description">The optional description as typed.</param>
public sealed record UploadOrderImageRequest(ReadOnlyMemory<byte> Bytes, string? FileName, string? Description);
