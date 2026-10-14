using System.Net.Http.Headers;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>Builds API requests, optionally with a bearer token, for integration tests.</summary>
internal static class ApiRequests
{
    /// <summary>Creates a request for a relative path.</summary>
    /// <param name="method">The HTTP method.</param>
    /// <param name="path">The relative path, for example <c>/api/v1/site-settings</c>.</param>
    /// <param name="bearerToken">The access token; no Authorization header when null.</param>
    /// <param name="accept">An Accept media type to send, for example <c>text/html</c>; none when null.</param>
    /// <returns>The request. The caller disposes it.</returns>
    public static HttpRequestMessage Create(HttpMethod method, string path, string? bearerToken = null, string? accept = null)
    {
        var request = new HttpRequestMessage(method, new Uri(path, UriKind.Relative));
        if (bearerToken is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", bearerToken);
        }

        if (accept is not null)
        {
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(accept));
        }

        return request;
    }

    /// <summary>Creates a GET request for a relative path.</summary>
    /// <param name="path">The relative path.</param>
    /// <param name="bearerToken">The access token; no Authorization header when null.</param>
    /// <param name="accept">An Accept media type to send; none when null.</param>
    /// <returns>The request. The caller disposes it.</returns>
    public static HttpRequestMessage Get(string path, string? bearerToken = null, string? accept = null) =>
        Create(HttpMethod.Get, path, bearerToken, accept);
}
