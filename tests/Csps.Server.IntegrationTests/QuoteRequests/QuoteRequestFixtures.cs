using System.Net.Http.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;

namespace Csps.Server.IntegrationTests.QuoteRequests;

/// <summary>Builds anonymous quote request posts for the Phase 13 tests.</summary>
internal static class QuoteRequestFixtures
{
    /// <summary>The public create route.</summary>
    public const string Route = "/api/v1/public/quote-requests";

    /// <summary>A body the server accepts: a name and a mobile number, nothing else.</summary>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> MinimalBody() => new()
    {
        ["customerName"] = "Juan Dela Cruz",
        ["contactNumber"] = "0917 123 4567",
    };

    /// <summary>Posts a quote request without a sign-in.</summary>
    /// <param name="client">The client.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, Route);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
