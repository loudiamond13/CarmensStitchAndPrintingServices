using System.Net.Http.Json;
using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.OrderLists;

/// <summary>Builds requests for the three order list routes and reads the answers (D-19 management tests).</summary>
internal static class OrderListFixtures
{
    /// <summary>The product types route.</summary>
    public const string ProductTypes = "/api/v1/product-types";

    /// <summary>The payment methods route.</summary>
    public const string PaymentMethods = "/api/v1/payment-methods";

    /// <summary>The order expense categories route.</summary>
    public const string OrderExpenseCategories = "/api/v1/order-expense-categories";

    /// <summary>The three routes with the audit action prefix and target type of each list.</summary>
    public static readonly IReadOnlyList<(string Route, string AuditPrefix, string TargetType)> Lists =
    [
        (ProductTypes, "product-type", "ProductType"),
        (PaymentMethods, "payment-method", "PaymentMethod"),
        (OrderExpenseCategories, "order-expense-category", "OrderExpenseCategory"),
    ];

    /// <summary>Gets the theory data of the three routes.</summary>
    public static TheoryData<string> Routes => [.. Lists.Select(static list => list.Route)];

    /// <summary>Makes a name that no other test in the class has used.</summary>
    /// <param name="prefix">The readable start of the name.</param>
    /// <returns>The prefix plus a short random suffix, within 40 characters.</returns>
    public static string UniqueName(string prefix) => $"{prefix} {Guid.NewGuid():N}"[..Math.Min(40, prefix.Length + 9)];

    /// <summary>Posts an entry with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, string route, string? accessToken, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, route, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts an entry, expects a 201 and returns its body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="name">The name.</param>
    /// <param name="tone">The tone.</param>
    /// <returns>The JSON body of the created entry.</returns>
    public static async Task<JsonElement> CreateAsync(HttpClient client, string route, string accessToken, string name, string tone)
    {
        using var response = await PostAsync(client, route, accessToken, new { name, tone });
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Puts an edit of one entry.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The entry id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutAsync(HttpClient client, string route, string? accessToken, Guid id, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{route}/{id:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Retires one entry with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The entry id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> RetireAsync(HttpClient client, string route, string? accessToken, Guid id) =>
        PostActionAsync(client, route, accessToken, id, "retire");

    /// <summary>Brings one retired entry back with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The entry id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> ReactivateAsync(HttpClient client, string route, string? accessToken, Guid id) =>
        PostActionAsync(client, route, accessToken, id, "reactivate");

    /// <summary>Deletes one entry.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The entry id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string route, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one entry.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The entry id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetAsync(HttpClient client, string route, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one entry and returns the 200 body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="id">The entry id.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadDetailAsync(HttpClient client, string route, string accessToken, Guid id)
    {
        using var response = await GetAsync(client, route, accessToken, id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Builds the edit form an unchanged copy of an entry would send, so a test can override one member.</summary>
    /// <param name="detail">The entry as the API returned it.</param>
    /// <returns>The body members, with the version the detail carried.</returns>
    public static Dictionary<string, object?> BodyFrom(JsonElement detail) => new()
    {
        ["name"] = detail.GetProperty("name").GetString(),
        ["tone"] = detail.GetProperty("tone").GetString(),
        ["version"] = detail.GetProperty("version").GetString(),
    };

    /// <summary>Reads a list and expects a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="route">The list route.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The list items.</returns>
    public static async Task<IReadOnlyList<JsonElement>> ReadListAsync(HttpClient client, string route, string accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(route, accessToken);
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return [.. document.RootElement.EnumerateArray().Select(static item => item.Clone())];
    }

    /// <summary>Counts the audit rows of one entry, optionally of one action.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="id">The entry id.</param>
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

    private static async Task<HttpResponseMessage> PostActionAsync(HttpClient client, string route, string? accessToken, Guid id, string action)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{route}/{id:D}/{action}", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }
}
