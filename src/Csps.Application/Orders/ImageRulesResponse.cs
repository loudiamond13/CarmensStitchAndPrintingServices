namespace Csps.Application.Orders;

/// <summary>The photo rules the server enforces, for the browser to check before it sends a file (OR-3, IMG-02).</summary>
/// <param name="MaxPerOrder">The most photos one order holds.</param>
/// <param name="MaxBytes">The largest file, in bytes.</param>
/// <param name="MaxPixels">The most pixels (width times height) a photo may have.</param>
/// <param name="MaxSide">The longest side, in pixels.</param>
/// <param name="Types">The accepted formats: <c>jpeg</c>, <c>png</c>, <c>webp</c> and <c>heic</c>.</param>
/// <param name="DescriptionMaxLength">The longest description, in characters.</param>
public sealed record ImageRulesResponse(int MaxPerOrder, int MaxBytes, long MaxPixels, int MaxSide, IReadOnlyList<string> Types, int DescriptionMaxLength);
