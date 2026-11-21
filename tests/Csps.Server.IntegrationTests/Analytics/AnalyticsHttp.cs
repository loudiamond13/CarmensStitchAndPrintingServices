using System.Globalization;
using System.Text;
using Csps.Server.Security;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Csps.Server.IntegrationTests.Analytics;

/// <summary>Shared HTTP helpers for the analytics integration tests: a client that keeps no cookies, a JSON post, and Set-Cookie readers.</summary>
internal static class AnalyticsHttp
{
    /// <summary>Creates a client that does not keep cookies, so each test sends exactly the cookies it names.</summary>
    /// <param name="factory">The test host.</param>
    /// <returns>A new client.</returns>
    internal static HttpClient NewClient(WebApplicationFactory<Program> factory) =>
        factory.CreateClient(new WebApplicationFactoryClientOptions { HandleCookies = false });

    /// <summary>Builds a JSON post to a route, with the anti-CSRF header unless asked not to.</summary>
    /// <param name="route">The relative route.</param>
    /// <param name="json">The request body.</param>
    /// <param name="csrf">Whether to add the anti-CSRF header.</param>
    /// <param name="userAgent">The User-Agent header, or null to send none.</param>
    /// <returns>The request.</returns>
    internal static HttpRequestMessage NewPost(string route, string json, bool csrf = true, string? userAgent = null)
    {
        var request = new HttpRequestMessage(HttpMethod.Post, new Uri(route, UriKind.Relative))
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        if (csrf)
        {
            request.Headers.Add(RequireCsrfHeaderAttribute.HeaderName, "1");
        }

        if (userAgent is not null)
        {
            request.Headers.TryAddWithoutValidation("User-Agent", userAgent);
        }

        return request;
    }

    /// <summary>Finds the Set-Cookie header for a cookie name.</summary>
    /// <param name="response">The response.</param>
    /// <param name="name">The cookie name.</param>
    /// <returns>The header value, or null when the cookie was not set.</returns>
    internal static string? SetCookieOf(HttpResponseMessage response, string name) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.FirstOrDefault(value => value.StartsWith(name + "=", StringComparison.Ordinal))
            : null;

    /// <summary>Reads the cookie value out of a Set-Cookie header.</summary>
    /// <param name="setCookie">The header value.</param>
    /// <returns>The cookie value.</returns>
    internal static string ValueOf(string setCookie) => setCookie.Split(';')[0][(setCookie.IndexOf('=', StringComparison.Ordinal) + 1)..];

    /// <summary>Reads the expiry out of a Set-Cookie header.</summary>
    /// <param name="setCookie">The header value.</param>
    /// <returns>The expiry instant.</returns>
    internal static DateTimeOffset ExpiresOf(string setCookie)
    {
        var expires = setCookie.Split(';').Select(part => part.Trim()).Single(part => part.StartsWith("expires=", StringComparison.OrdinalIgnoreCase));
        return DateTimeOffset.Parse(expires["expires=".Length..], CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal);
    }
}
