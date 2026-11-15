namespace Csps.Application.Content;

/// <summary>A share picture upload as the server received it: the file bytes held in memory, never on disk (D-26, IMG-02).</summary>
/// <param name="Bytes">The whole file; empty when no file was sent.</param>
/// <param name="FileName">The name the client gave the file; only used in an error message.</param>
public sealed record UploadSharePictureRequest(ReadOnlyMemory<byte> Bytes, string? FileName);
