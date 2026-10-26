using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

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

    /// <summary>Puts an edit of one category.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The category id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutAsync(HttpClient client, string? accessToken, Guid id, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{id:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Retires one category with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The category id.</param>
    /// <param name="withKey">False to send no key.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> RetireAsync(HttpClient client, string? accessToken, Guid id, bool withKey = true) =>
        PostActionAsync(client, accessToken, id, "retire", withKey);

    /// <summary>Brings one retired category back with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The category id.</param>
    /// <param name="withKey">False to send no key.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> ReactivateAsync(HttpClient client, string? accessToken, Guid id, bool withKey = true) =>
        PostActionAsync(client, accessToken, id, "reactivate", withKey);

    /// <summary>Deletes one category.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The category id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one category.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The category id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one category and returns the 200 body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="id">The category id.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadDetailAsync(HttpClient client, string accessToken, Guid id)
    {
        using var response = await GetAsync(client, accessToken, id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Builds the edit form an unchanged copy of a category would send, so a test can override one member.</summary>
    /// <param name="detail">The category as the API returned it.</param>
    /// <returns>The body members, with the version the detail carried.</returns>
    public static Dictionary<string, object?> BodyFrom(JsonElement detail) => new()
    {
        ["name"] = detail.GetProperty("name").GetString(),
        ["tone"] = detail.GetProperty("tone").GetString(),
        ["version"] = detail.GetProperty("version").GetString(),
    };

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

    /// <summary>Counts the audit rows of one category, optionally of one action.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="id">The category id.</param>
    /// <param name="action">The action code; every action when null.</param>
    /// <returns>The number of rows.</returns>
    public static async Task<int> AuditCountAsync(CspsDatabase database, Guid id, string? action = null)
    {
        ArgumentNullException.ThrowIfNull(database);
        var key = id.ToString("D");
        await using var context = database.CreateContext();
        return await context.AuditLog.CountAsync(
            row => row.TargetId == key && (action == null || row.Action == action),
            TestContext.Current.CancellationToken);
    }

    /// <summary>Returns the messages of one field of a 400 answer.</summary>
    /// <param name="problem">The ProblemDetails body.</param>
    /// <param name="field">The field name.</param>
    /// <returns>The messages; empty when the field has none.</returns>
    public static IReadOnlyList<string> FieldErrors(JsonElement problem, string field) =>
        problem.TryGetProperty("errors", out var errors) && errors.TryGetProperty(field, out var messages)
            ? [.. messages.EnumerateArray().Select(static message => message.GetString() ?? string.Empty)]
            : [];

    private static async Task<HttpResponseMessage> PostActionAsync(HttpClient client, string? accessToken, Guid id, string action, bool withKey)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/{action}", accessToken);
        if (withKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
