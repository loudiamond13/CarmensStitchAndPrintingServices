namespace Csps.Application.QuoteRequests;

/// <summary>One photo a visitor sends to a place of a saved quote request (INQ-02).</summary>
/// <param name="Bytes">The whole file.</param>
/// <param name="FileName">The name the browser sent; only shown in a message, never trusted for anything else.</param>
/// <param name="UploadKey">The <c>X-Upload-Key</c> header the visitor made when the request was saved.</param>
public sealed record UploadQuotePhotoRequest(ReadOnlyMemory<byte> Bytes, string? FileName, string? UploadKey);
