using System.ComponentModel;

namespace Csps.Application.Content;

/// <summary>
/// A public answer kept as UTF-8 JSON text with its strong ETag (CONT-05). The ETag is a hash of the exact bytes sent, so it changes
/// exactly when the answer does.
/// </summary>
/// <param name="Json">The JSON text.</param>
/// <param name="ETag">The strong entity tag, quotes included.</param>
/// <param name="LastChangedUtc">The newest change the answer shows, for the sitemap.</param>
[ImmutableObject(true)]
public sealed record PublicJsonSnapshot(string Json, string ETag, DateTimeOffset LastChangedUtc);
