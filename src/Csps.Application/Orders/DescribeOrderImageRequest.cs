namespace Csps.Application.Orders;

/// <summary>
/// Sets or clears one photo's description on a saved order (ORD-04, D-12, D-30). It carries the order's version as the page was
/// opened. Any other member in the body is ignored.
/// </summary>
/// <param name="Description">The description; empty, missing or the default text means none.</param>
/// <param name="Version">The base64 of the eight-byte row version of the order the page was opened with.</param>
public sealed record DescribeOrderImageRequest(string? Description, string? Version)
{
    /// <summary>Gets the request used when the body is empty or unreadable, so the validator reports every missing field.</summary>
    public static DescribeOrderImageRequest Empty { get; } = new(null, null);
}
