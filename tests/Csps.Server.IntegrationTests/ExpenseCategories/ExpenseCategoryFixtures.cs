using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;

namespace Csps.Server.IntegrationTests.ExpenseCategories;

/// <summary>Builds expense category requests and reads the answers (Phase 6 category management tests).</summary>
internal static class ExpenseCategoryFixtures
{
    /// <summary>The expense categories route.</summary>
    public const string Route = "/api/v1/expense-categories";

    /// <summary>Makes a category name that no other test in the class has used.</summary>
    /// <param name="prefix">The readable start of the name.</param>
    /// <returns>The prefix plus a short random suffix, within 40 characters.</returns>
    public static string UniqueName(string prefix) => $"{prefix} {Guid.NewGuid():N}"[..Math.Min(40, prefix.Length + 9)];

    /// <summary>Posts a category with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, string? accessToken, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, Route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a category, expects a 201 and returns its body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="name">The name.</param>
    /// <param name="tone">The tone.</param>
    /// <returns>The JSON body of the created category.</returns>
    public static async Task<JsonElement> CreateAsync(HttpClient client, string accessToken, string name, string tone)
    {
        using var response = await PostAsync(client, accessToken, new { name, tone });
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Reads the category list and expects a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The list items.</returns>
    public static async Task<IReadOnlyList<JsonElement>> ReadListAsync(HttpClient client, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(Route, accessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return [.. document.RootElement.EnumerateArray().Select(static item => item.Clone())];
    }

    /// <summary>Returns the messages of one field of a 400 answer.</summary>
    /// <param name="problem">The ProblemDetails body.</param>
    /// <param name="field">The field name.</param>
    /// <returns>The messages; empty when the field has none.</returns>
    public static IReadOnlyList<string> FieldErrors(JsonElement problem, string field) =>
        problem.TryGetProperty("errors", out var errors) && errors.TryGetProperty(field, out var messages)
            ? [.. messages.EnumerateArray().Select(static message => message.GetString() ?? string.Empty)]
            : [];
}
