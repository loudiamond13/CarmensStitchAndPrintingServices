using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.OrderLists;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
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

    /// <summary>The id of the seeded Cash payment method.</summary>
    public static readonly Guid CashId = PaymentMethodId("Cash");

    /// <summary>The id of the seeded GCash payment method.</summary>
    public static readonly Guid GCashId = PaymentMethodId("GCash");

    /// <summary>The id of the seeded Fabric order expense category.</summary>
    public static readonly Guid FabricId = ExpenseCategoryId("Fabric");

    /// <summary>The id of the seeded Ink &amp; paper order expense category.</summary>
    public static readonly Guid InkAndPaperId = ExpenseCategoryId("Ink & paper");

    /// <summary>The id of the seeded Outsourcing order expense category.</summary>
    public static readonly Guid OutsourcingId = ExpenseCategoryId("Outsourcing");

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

    /// <summary>
    /// The whole ORD-2026-0148 aggregate in one create body: five items, the 5% league discount, payments of 10,000.00 (GCash) and
    /// 2,000.00 (Cash), and expenses of 3,825.00 Fabric, 1,640.00 Ink &amp; paper and 600.00 Outsourcing (UI-spec section 12.2).
    /// </summary>
    /// <param name="today">The business today.</param>
    /// <param name="adminId">The Admin who received the GCash payment and paid the ink and the outsourcing.</param>
    /// <param name="managerId">The Manager who received the cash and paid the fabric.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> Ord0148FullBody(DateOnly today, Guid adminId, Guid managerId)
    {
        var body = Ord0148ItemsBody(today);
        body["discounts"] = new[] { new Dictionary<string, object?> { ["kind"] = "percentage", ["value"] = 5m, ["reason"] = "Barangay league discount" } };
        body["payments"] = new[]
        {
            PaymentItem(today.AddDays(-3), 10000.00m, GCashId, adminId, "9012 345 678901", "50% downpayment"),
            PaymentItem(today.AddDays(-1), 2000.00m, CashId, managerId, null, "For 2 added coach polos"),
        };
        body["expenses"] = new[]
        {
            ExpenseItem(today.AddDays(-6), FabricId, "Dri-fit mesh, 45 yds", 3825.00m, managerId),
            ExpenseItem(today.AddDays(-5), InkAndPaperId, "Sublimation ink + transfer paper", 1640.00m, adminId),
            ExpenseItem(today.AddDays(-3), OutsourcingId, "Embroidery, coach polos", 600.00m, adminId),
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

    /// <summary>Puts the edit form of one item.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="itemId">The item id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutItemAsync(HttpClient client, string? accessToken, Guid orderId, Guid itemId, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{orderId:D}/items/{itemId:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Removes one item.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="itemId">The item id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteItemAsync(HttpClient client, string? accessToken, Guid orderId, Guid itemId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{orderId:D}/items/{itemId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds an item, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="order">The order as the last answer carried it; its version is sent.</param>
    /// <param name="productTypeId">The product type of the new item.</param>
    /// <param name="description">What the item is.</param>
    /// <returns>The JSON body of the order after the add.</returns>
    public static async Task<JsonElement> AddItemAndReadAsync(HttpClient client, string accessToken, JsonElement order, Guid productTypeId, string description = "Coach polo")
    {
        using var response = await AddItemAsync(
            client,
            accessToken,
            order.GetProperty("id").GetGuid(),
            ItemBody(productTypeId, order.GetProperty("version").GetString(), description));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Builds the body of a discount add or edit: kind, value, reason plus the order's version.</summary>
    /// <param name="kind">The wire kind, <c>fixed</c> or <c>percentage</c>.</param>
    /// <param name="value">The peso amount or the percent.</param>
    /// <param name="reason">Why the discount is given.</param>
    /// <param name="version">The order's version as the last answer carried it.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> DiscountBody(string? kind, decimal? value, string? reason, string? version) => new()
    {
        ["kind"] = kind,
        ["value"] = value,
        ["reason"] = reason,
        ["version"] = version,
    };

    /// <summary>Posts a discount to a saved order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> AddDiscountAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/discounts", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Puts the edit form of one discount.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="discountId">The discount id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutDiscountAsync(HttpClient client, string? accessToken, Guid orderId, Guid discountId, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{orderId:D}/discounts/{discountId:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Removes one discount.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="discountId">The discount id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteDiscountAsync(HttpClient client, string? accessToken, Guid orderId, Guid discountId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{orderId:D}/discounts/{discountId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds a discount, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="order">The order as the last answer carried it; its version is sent.</param>
    /// <param name="kind">The wire kind.</param>
    /// <param name="value">The value.</param>
    /// <param name="reason">The reason.</param>
    /// <returns>The JSON body of the order after the add.</returns>
    public static async Task<JsonElement> AddDiscountAndReadAsync(HttpClient client, string accessToken, JsonElement order, string kind, decimal value, string reason = "Barangay league discount")
    {
        using var response = await AddDiscountAsync(
            client,
            accessToken,
            order.GetProperty("id").GetGuid(),
            DiscountBody(kind, value, reason, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Builds the body of a payment add or edit: the payment fields plus the order's version.</summary>
    /// <param name="paymentDate">The day the money was received.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paymentMethodId">The payment method.</param>
    /// <param name="receivedByUserId">Who received the money.</param>
    /// <param name="version">The order's version as the last answer carried it.</param>
    /// <param name="reference">The reference text.</param>
    /// <param name="notes">The notes text.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> PaymentBody(DateOnly? paymentDate, decimal? amount, Guid? paymentMethodId, Guid? receivedByUserId, string? version, string? reference = null, string? notes = null) => new()
    {
        ["paymentDate"] = paymentDate is { } date ? Date(date) : null,
        ["amount"] = amount,
        ["paymentMethodId"] = paymentMethodId,
        ["reference"] = reference,
        ["notes"] = notes,
        ["receivedByUserId"] = receivedByUserId,
        ["version"] = version,
    };

    /// <summary>Builds one payment of the create body.</summary>
    /// <param name="paymentDate">The day the money was received.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paymentMethodId">The payment method.</param>
    /// <param name="receivedByUserId">Who received the money.</param>
    /// <param name="reference">The reference text.</param>
    /// <param name="notes">The notes text.</param>
    /// <returns>The payment members.</returns>
    public static Dictionary<string, object?> PaymentItem(DateOnly paymentDate, decimal amount, Guid paymentMethodId, Guid receivedByUserId, string? reference = null, string? notes = null) => new()
    {
        ["paymentDate"] = Date(paymentDate),
        ["amount"] = amount,
        ["paymentMethodId"] = paymentMethodId,
        ["reference"] = reference,
        ["notes"] = notes,
        ["receivedByUserId"] = receivedByUserId,
    };

    /// <summary>Adds a payment method of its own to the test database, so a test never retires a seeded one.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="retired">True to retire it at once.</param>
    /// <returns>The new method's id.</returns>
    public static async Task<Guid> AddPaymentMethodAsync(CspsDatabase database, bool retired)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var method = PaymentMethod.Create($"Test {Guid.NewGuid():N}"[..21], "neutral", TimeProvider.System.GetUtcNow()).Value;
        if (retired)
        {
            method.Retire(TimeProvider.System.GetUtcNow()).IsSuccess.ShouldBeTrue();
        }

        context.PaymentMethods.Add(method);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return method.Id;
    }

    /// <summary>Retires a payment method that was in use.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="paymentMethodId">The method to retire.</param>
    /// <returns>A task that completes once the method is retired.</returns>
    public static async Task RetirePaymentMethodAsync(CspsDatabase database, Guid paymentMethodId)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var at = TimeProvider.System.GetUtcNow();
        await context.PaymentMethods.Where(method => method.Id == paymentMethodId)
            .ExecuteUpdateAsync(set => set.SetProperty(method => method.RetiredAtUtc, at), TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a payment to a saved order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> AddPaymentAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/payments", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Puts the edit form of one payment.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="paymentId">The payment id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutPaymentAsync(HttpClient client, string? accessToken, Guid orderId, Guid paymentId, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{orderId:D}/payments/{paymentId:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Removes one payment.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="paymentId">The payment id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeletePaymentAsync(HttpClient client, string? accessToken, Guid orderId, Guid paymentId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{orderId:D}/payments/{paymentId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds a payment, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="order">The order as the last answer carried it; its version is sent.</param>
    /// <param name="paymentDate">The day the money was received.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paymentMethodId">The payment method.</param>
    /// <param name="receivedByUserId">Who received the money.</param>
    /// <returns>The JSON body of the order after the add.</returns>
    public static async Task<JsonElement> AddPaymentAndReadAsync(HttpClient client, string accessToken, JsonElement order, DateOnly paymentDate, decimal amount, Guid paymentMethodId, Guid receivedByUserId)
    {
        using var response = await AddPaymentAsync(
            client,
            accessToken,
            order.GetProperty("id").GetGuid(),
            PaymentBody(paymentDate, amount, paymentMethodId, receivedByUserId, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Builds the body of an order expense add or edit: the expense fields plus the order's version.</summary>
    /// <param name="expenseDate">The day of the expense.</param>
    /// <param name="categoryId">The order expense category.</param>
    /// <param name="description">The description text.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paidByUserId">Who paid.</param>
    /// <param name="version">The order's version as the last answer carried it.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> ExpenseBody(DateOnly? expenseDate, Guid? categoryId, string? description, decimal? amount, Guid? paidByUserId, string? version) => new()
    {
        ["expenseDate"] = expenseDate is { } date ? Date(date) : null,
        ["orderExpenseCategoryId"] = categoryId,
        ["description"] = description,
        ["amount"] = amount,
        ["paidByUserId"] = paidByUserId,
        ["version"] = version,
    };

    /// <summary>Builds one expense of the create body.</summary>
    /// <param name="expenseDate">The day of the expense.</param>
    /// <param name="categoryId">The order expense category.</param>
    /// <param name="description">The description text.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paidByUserId">Who paid.</param>
    /// <returns>The expense members.</returns>
    public static Dictionary<string, object?> ExpenseItem(DateOnly expenseDate, Guid categoryId, string? description, decimal amount, Guid paidByUserId) => new()
    {
        ["expenseDate"] = Date(expenseDate),
        ["orderExpenseCategoryId"] = categoryId,
        ["description"] = description,
        ["amount"] = amount,
        ["paidByUserId"] = paidByUserId,
    };

    /// <summary>Posts an expense to a saved order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> AddExpenseAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/expenses", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Puts the edit form of one expense.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="expenseId">The expense id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutExpenseAsync(HttpClient client, string? accessToken, Guid orderId, Guid expenseId, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{orderId:D}/expenses/{expenseId:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Removes one expense.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="expenseId">The expense id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteExpenseAsync(HttpClient client, string? accessToken, Guid orderId, Guid expenseId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{orderId:D}/expenses/{expenseId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds an expense, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="order">The order as the last answer carried it; its version is sent.</param>
    /// <param name="expenseDate">The day of the expense.</param>
    /// <param name="categoryId">The order expense category.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="paidByUserId">Who paid.</param>
    /// <param name="description">The description text.</param>
    /// <returns>The JSON body of the order after the add.</returns>
    public static async Task<JsonElement> AddExpenseAndReadAsync(HttpClient client, string accessToken, JsonElement order, DateOnly expenseDate, Guid categoryId, decimal amount, Guid paidByUserId, string? description = null)
    {
        using var response = await AddExpenseAsync(
            client,
            accessToken,
            order.GetProperty("id").GetGuid(),
            ExpenseBody(expenseDate, categoryId, description, amount, paidByUserId, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Adds an order expense category of its own to the test database, so a test never retires a seeded one.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="retired">True to retire it at once.</param>
    /// <returns>The new category's id.</returns>
    public static async Task<Guid> AddExpenseCategoryAsync(CspsDatabase database, bool retired)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var category = OrderExpenseCategory.Create($"Test {Guid.NewGuid():N}"[..21], "neutral", TimeProvider.System.GetUtcNow()).Value;
        if (retired)
        {
            category.Retire(TimeProvider.System.GetUtcNow()).IsSuccess.ShouldBeTrue();
        }

        context.OrderExpenseCategories.Add(category);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return category.Id;
    }

    /// <summary>Retires an order expense category that was in use.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="categoryId">The category to retire.</param>
    /// <returns>A task that completes once the category is retired.</returns>
    public static async Task RetireExpenseCategoryAsync(CspsDatabase database, Guid categoryId)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var at = TimeProvider.System.GetUtcNow();
        await context.OrderExpenseCategories.Where(category => category.Id == categoryId)
            .ExecuteUpdateAsync(set => set.SetProperty(category => category.RetiredAtUtc, at), TestContext.Current.CancellationToken);
    }

    /// <summary>Builds the body of a status change.</summary>
    /// <param name="status">The status key, such as <c>mockup</c>.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> StatusBody(string? status) => new() { ["status"] = status };

    /// <summary>Posts a status change with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ChangeStatusAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/status", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Changes the status, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="status">The status key to move to.</param>
    /// <returns>The JSON body of the order after the change.</returns>
    public static async Task<JsonElement> ChangeStatusAndReadAsync(HttpClient client, string accessToken, Guid orderId, string status)
    {
        using var response = await ChangeStatusAsync(client, accessToken, orderId, StatusBody(status));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Creates the whole ORD-2026-0148 order and pays what is left, so its balance is exactly 0.00.</summary>
    /// <param name="client">The client.</param>
    /// <param name="admin">The Admin, who creates the order and receives the last payment.</param>
    /// <param name="manager">The Manager, who is named on some payments and expenses.</param>
    /// <param name="today">The business today.</param>
    /// <returns>The JSON body of the order after the last payment.</returns>
    public static async Task<JsonElement> Ord0148PaidInFullAsync(HttpClient client, StartedSession admin, StartedSession manager, DateOnly today)
    {
        ArgumentNullException.ThrowIfNull(client);
        ArgumentNullException.ThrowIfNull(admin);
        ArgumentNullException.ThrowIfNull(manager);
        var order = await CreateAsync(client, admin.AccessToken, Ord0148FullBody(today, admin.UserId, manager.UserId));
        var paid = await AddPaymentAndReadAsync(client, admin.AccessToken, order, today, 9327.50m, CashId, admin.UserId);
        paid.GetProperty("totals").GetProperty("balance").GetDecimal().ShouldBe(0.00m);
        return paid;
    }

    /// <summary>Builds the body of a refund add or edit: the refund fields plus the order's version.</summary>
    /// <param name="refundDate">The day the money was handed back.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="reason">The reason text.</param>
    /// <param name="refundedByUserId">Who handed the money back.</param>
    /// <param name="version">The order's version as the last answer carried it.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> RefundBody(DateOnly? refundDate, decimal? amount, string? reason, Guid? refundedByUserId, string? version) => new()
    {
        ["refundDate"] = refundDate is { } date ? Date(date) : null,
        ["amount"] = amount,
        ["reason"] = reason,
        ["refundedByUserId"] = refundedByUserId,
        ["version"] = version,
    };

    /// <summary>Posts a refund to a saved order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> AddRefundAsync(HttpClient client, string? accessToken, Guid orderId, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{orderId:D}/refunds", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Puts the edit form of one refund.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="refundId">The refund id.</param>
    /// <param name="body">The body; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PutRefundAsync(HttpClient client, string? accessToken, Guid orderId, Guid refundId, object? body)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Put, $"{Route}/{orderId:D}/refunds/{refundId:D}", accessToken);
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Removes one refund.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="orderId">The order id.</param>
    /// <param name="refundId">The refund id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteRefundAsync(HttpClient client, string? accessToken, Guid orderId, Guid refundId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{orderId:D}/refunds/{refundId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds a refund, expects a 200 and returns the whole order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="order">The order as the last answer carried it; its version is sent.</param>
    /// <param name="refundDate">The day the money was handed back.</param>
    /// <param name="amount">The amount in pesos.</param>
    /// <param name="refundedByUserId">Who handed the money back.</param>
    /// <param name="reason">The reason text.</param>
    /// <returns>The JSON body of the order after the add.</returns>
    public static async Task<JsonElement> AddRefundAndReadAsync(HttpClient client, string accessToken, JsonElement order, DateOnly refundDate, decimal amount, Guid refundedByUserId, string reason = "Order cancelled by the team")
    {
        using var response = await AddRefundAsync(
            client,
            accessToken,
            order.GetProperty("id").GetGuid(),
            RefundBody(refundDate, amount, reason, refundedByUserId, order.GetProperty("version").GetString()));
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Soft-deletes one order.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The order id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Restores one soft-deleted order with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The order id.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> RestoreAsync(HttpClient client, string? accessToken, Guid id, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/restore", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Deletes one order for good.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The order id.</param>
    /// <param name="confirm">The number typed to confirm; no query value when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PermanentlyDeleteAsync(HttpClient client, string? accessToken, Guid id, string? confirm)
    {
        ArgumentNullException.ThrowIfNull(client);
        var path = $"{Route}/{id:D}/permanent";
        using var request = ApiRequests.Create(HttpMethod.Delete, confirm is null ? path : $"{path}?confirm={Uri.EscapeDataString(confirm)}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Lists the deleted orders.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The query string without the question mark, such as <c>pageSize=10</c>; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ListDeletedAsync(HttpClient client, string? accessToken, string? query = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(query is null ? $"{Route}/deleted" : $"{Route}/deleted?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Lists the deleted orders, expects a 200 and returns the page.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The query string without the question mark; none when null.</param>
    /// <returns>The JSON body of the page.</returns>
    public static async Task<JsonElement> ReadDeletedPageAsync(HttpClient client, string accessToken, string? query = null)
    {
        using var response = await ListDeletedAsync(client, accessToken, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Lists the orders.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The query string without the question mark, such as <c>status=all&amp;pageSize=10</c>; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ListAsync(HttpClient client, string? accessToken, string? query = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(string.IsNullOrEmpty(query) ? Route : $"{Route}?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Lists the orders, expects a 200 and returns the page.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The query string without the question mark; none when null.</param>
    /// <returns>The JSON body of the page.</returns>
    public static async Task<JsonElement> ReadListAsync(HttpClient client, string accessToken, string? query = null)
    {
        using var response = await ListAsync(client, accessToken, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
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

    private static Guid ExpenseCategoryId(string name) => OrderListSeed.OrderExpenseCategories.Single(row => row.Name == name).Id;

    private static Guid PaymentMethodId(string name) => OrderListSeed.PaymentMethods.Single(row => row.Name == name).Id;
}
