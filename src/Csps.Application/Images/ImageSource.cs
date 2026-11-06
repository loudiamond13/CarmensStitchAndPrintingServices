namespace Csps.Application.Images;

/// <summary>An image address and its candidates for the browser's <c>srcset</c> (IMG-04).</summary>
/// <param name="Src">The address used when the browser cannot pick a candidate.</param>
/// <param name="SrcSet">The candidates with their <c>w</c> or <c>x</c> descriptors, comma separated.</param>
public sealed record ImageSource(string Src, string SrcSet);

/// <summary>The addresses of one order photo, one per display slot.</summary>
/// <param name="Thumb">The 88 px tile thumb, with a 2x candidate.</param>
/// <param name="Viewer">The whole photo in the viewer, with width candidates.</param>
/// <param name="FullSize">The address of the 2000 px JPEG behind "Open Full Size".</param>
public sealed record PhotoUrls(ImageSource Thumb, ImageSource Viewer, string FullSize);

/// <summary>The addresses of an order's cover photo, one per display slot.</summary>
/// <param name="Card">The 16:10 card cover, with width candidates.</param>
/// <param name="Table">The 44 px table thumb, with a 2x candidate.</param>
public sealed record CoverUrls(ImageSource Card, ImageSource Table);
