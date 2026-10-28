using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Orders;

/// <summary>Builds order requests and reads the answers (Phase 7 order tests).</summary>
internal static class OrderFixtures
{
    /// <summary>The orders route.</summary>
    public const string Route = "/api/v1/orders";

    /// <summary>The id of the seeded Basketball Jersey product type.</summary>
    public static readonly Guid BasketballId = ProductTypeId("Basketball Jersey");

    /// <summary>The id of the seeded Long Sleeves product type.</summary>
    public static readonly Guid LongSleevesId = ProductTypeId("Long Sleeves");

    /// <summary>The id of the seeded Polo Shirt product type.</summary>
    public static readonly Guid PoloId = ProductTypeId("Polo Shirt");

    /// <summary>The id of the seeded Custom Design product type.</summary>
    public static readonly Guid CustomDesignId = ProductTypeId("Custom Design");

    /// <summary>One order item as a dictionary so a test can override a member.</summary>
    /// <param name="productTypeId">The product type.</param>
    /// <param name="description">What the item is.</param>
    /// <param name="sizeVariant">The size or variant.</param>
    /// <param name="quantity">The quantity.</param>
    /// <param name="unitPrice">The unit price.</param>
    /// <returns>The item members.</returns>
    public static Dictionary<string, object?> Item(Guid productTypeId, string description = "Jersey top", string? sizeVariant = "S-XL", int quantity = 15, decimal unitPrice = 650.00m) => new()
    {
        ["productTypeId"] = productTypeId,
        ["description"] = description,
        ["sizeVariant"] = sizeVariant,
        ["quantity"] = quantity,
        ["unitPrice"] = unitPrice,
    };

    /// <summary>A body the server accepts: one jersey line of 15 at 650.00.</summary>
    /// <param name="productTypeId">The product type of the one item.</param>
    /// <param name="today">The business today; the order date, with a due date 14 days later.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> ValidBody(Guid productTypeId, DateOnly today) => new()
    {
        ["customerName"] = "Juan Dela Cruz",
        ["teamName"] = "Brgy. San Roque Ballers",
        ["contactNumber"] = "0917 123 4567",
        ["email"] = "juan.dc@example.com",
        ["address"] = null,
        ["orderDate"] = Date(today),
        ["dueDate"] = Date(today.AddDays(14)),
        ["notes"] = null,
        ["items"] = new[] { Item(productTypeId) },
    };

    /// <summary>The ORD-2026-0148 order: five lines that add up to 22,450.00.</summary>
    /// <param name="today">The business today.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> Ord0148ItemsBody(DateOnly today)
    {
        var body = ValidBody(BasketballId, today);
        body["items"] = new[]
        {
            Item(BasketballId, "Jersey top", "S-XL", 15, 650.00m),
            Item(BasketballId, "Jersey shorts", "S-XL", 15, 300.00m),
            Item(PoloId, "Coach polo", "L", 2, 550.00m),
            Item(LongSleevesId, "Warm-up long sleeves", "M-XL", 15, 420.00m),
            Item(CustomDesignId, "Team banner", null, 1, 800.00m),
        };
        return body;
    }

    /// <summary>Formats a date as the wire does.</summary>
    /// <param name="date">The date.</param>
    /// <returns>The <c>yyyy-MM-dd</c> text.</returns>
    public static string Date(DateOnly date) => date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);

    /// <summary>Posts an order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null, none at all when <paramref name="withKey"/> is false.</param>
    /// <param name="withKey">False to send no key.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostAsync(HttpClient client, string? accessToken, object? body, Guid? idempotencyKey = null, bool withKey = true)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, Route, accessToken);
        if (withKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        }

        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Puts the details edit form of one order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutDetailsAsync(HttpClient client, string? accessToken, Guid id, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{id:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Builds the body of an item add or edit: the item fields plus the order's version.</summary>
    /// <param name="productTypeId">The product type.</param>
    /// <param name="version">The order's version as the last answer carried it.</param>
    /// <param name="description">What the item is.</param>
    /// <param name="sizeVariant">The size or variant.</param>
    /// <param name="quantity">The quantity.</param>
    /// <param name="unitPrice">The unit price.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> ItemBody(Guid productTypeId, string? version, string description = "Coach polo", string? sizeVariant = "L", int quantity = 2, decimal unitPrice = 550.00m)
    {
        var body = Item(productTypeId, description, sizeVariant, quantity, unitPrice);
        body["version"] = version;
        return body;
    }

    /// <summary>Posts an item to a saved order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> AddItemAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/items", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Builds the details form an unchanged copy of an order would send, so a test can override one member.</summary>
    /// <param name="detail">The order as the API returned it.</param>
    /// <returns>The body members, with the version the detail carried.</returns>
    public static Dictionary<string, object?> DetailsBodyFrom(JsonElement detail) => new()
    {
        ["customerName"] = detail.GetProperty("customerName").GetString(),
        ["teamName"] = TextOrNull(detail, "teamName"),
        ["contactNumber"] = TextOrNull(detail, "contactNumber"),
        ["email"] = TextOrNull(detail, "email"),
        ["address"] = TextOrNull(detail, "address"),
        ["orderDate"] = TextOrNull(detail, "orderDate"),
        ["dueDate"] = TextOrNull(detail, "dueDate"),
        ["notes"] = TextOrNull(detail, "notes"),
        ["version"] = detail.GetProperty("version").GetString(),
    };

    /// <summary>Reads one order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The order id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one order and returns the 200 body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="id">The order id.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadDetailAsync(HttpClient client, string accessToken, Guid id)
    {
        using var response = await GetAsync(client, accessToken, id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Posts an order, expects a 201 and returns its body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="body">The body.</param>
    /// <returns>The JSON body of the created order.</returns>
    public static async Task<JsonElement> CreateAsync(HttpClient client, string accessToken, object body)
    {
        using var response = await PostAsync(client, accessToken, body);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Reads today's date in the business zone from the host's own calendar.</summary>
    /// <param name="factory">The test host.</param>
    /// <returns>The business today.</returns>
    public static async Task<DateOnly> TodayAsync(CspsApiFactory factory)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var calendar = scope.ServiceProvider.GetRequiredService<IBusinessCalendar>();
            return (await calendar.GetClockAsync(TestContext.Current.CancellationToken)).Today;
        }
    }

    /// <summary>True when a member is absent or null.</summary>
    /// <param name="element">The object.</param>
    /// <param name="name">The member name.</param>
    /// <returns>True for absent or null.</returns>
    public static bool IsNull(JsonElement element, string name) =>
        !element.TryGetProperty(name, out var value) || value.ValueKind == JsonValueKind.Null;

    /// <summary>Returns the messages of one field of a 400 answer.</summary>
    /// <param name="problem">The ProblemDetails body.</param>
    /// <param name="field">The field name.</param>
    /// <returns>The messages; empty when the field has none.</returns>
    public static IReadOnlyList<string> FieldErrors(JsonElement problem, string field) =>
        problem.TryGetProperty("errors", out var errors) && errors.TryGetProperty(field, out var messages)
            ? [.. messages.EnumerateArray().Select(message => message.GetString() ?? string.Empty)]
            : [];

    /// <summary>Returns the names of the fields a 400 answer lists.</summary>
    /// <param name="problem">The ProblemDetails body.</param>
    /// <returns>The field names, sorted.</returns>
    public static IReadOnlyList<string> ErrorFields(JsonElement problem) =>
        problem.TryGetProperty("errors", out var errors)
            ? [.. errors.EnumerateObject().Select(property => property.Name).Order(StringComparer.Ordinal)]
            : [];

    private static string? TextOrNull(JsonElement element, string name) => IsNull(element, name) ? null : element.GetProperty(name).GetString();

    private static Guid ProductTypeId(string name) => OrderListSeed.ProductTypes.Single(row => row.Name == name).Id;
}
