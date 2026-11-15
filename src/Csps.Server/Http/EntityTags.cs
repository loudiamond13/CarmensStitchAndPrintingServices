using Microsoft.Net.Http.Headers;

namespace Csps.Server.Http;

/// <summary>Conditional GET helpers shared by the shell and the public reads (CONT-05).</summary>
internal static class EntityTags
{
    /// <summary>
    /// True when the request's <c>If-None-Match</c> is <c>*</c> or names <paramref name="etag"/>. Weak comparison, as RFC 9110 says for
    /// <c>If-None-Match</c>, so a weak tag from a proxy still matches.
    /// </summary>
    /// <param name="request">The request.</param>
    /// <param name="etag">The current entity tag.</param>
    /// <returns>True when the visitor's copy is current.</returns>
    public static bool Matches(HttpRequest request, EntityTagHeaderValue etag)
    {
        ArgumentNullException.ThrowIfNull(request);
        ArgumentNullException.ThrowIfNull(etag);

        var candidates = request.GetTypedHeaders().IfNoneMatch;
        return candidates.Any(candidate => candidate.Equals(EntityTagHeaderValue.Any) || candidate.Compare(etag, useStrongComparison: false));
    }
}
