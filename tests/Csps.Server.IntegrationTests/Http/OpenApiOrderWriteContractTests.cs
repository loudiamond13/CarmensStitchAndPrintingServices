using System.Net;
using System.Text.Json;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Http;

/// <summary>
/// IWB-WR-02, IWB-WR-03, APX-WR-01: the published contract says what the order and order list writes really answer. A change on a
/// Completed or Cancelled order is a 422 <c>orders.locked</c>, renaming Others is a 400 and not a 422, a payment change that would
/// drop below the refunds is a 422, and a list entry create that loses a deadlock is a 409.
/// </summary>
public sealed class OpenApiOrderWriteContractTests
{
    public static TheoryData<string, string> LockedWrites() => new()
    {
        { "put", "/api/v1/orders/{id}" },
        { "put", "/api/v1/orders/{orderId}/discounts/{discountId}" },
        { "delete", "/api/v1/orders/{orderId}/discounts/{discountId}" },
        { "put", "/api/v1/orders/{orderId}/payments/{paymentId}" },
        { "delete", "/api/v1/orders/{orderId}/payments/{paymentId}" },
        { "put", "/api/v1/orders/{orderId}/expenses/{expenseId}" },
        { "delete", "/api/v1/orders/{orderId}/expenses/{expenseId}" },
        { "post", "/api/v1/orders/{orderId}/items" },
        { "put", "/api/v1/orders/{orderId}/items/{itemId}" },
        { "delete", "/api/v1/orders/{orderId}/items/{itemId}" },
        { "post", "/api/v1/orders/{orderId}/discounts" },
        { "post", "/api/v1/orders/{orderId}/payments" },
        { "post", "/api/v1/orders/{orderId}/expenses" },
        { "put", "/api/v1/orders/{orderId}/refunds/{refundId}" },
        { "post", "/api/v1/orders/{orderId}/refunds" },
    };

    [Theory]
    [MemberData(nameof(LockedWrites))]
    public async Task EveryOrderWriteDeclaresTheLockedAnswerAndSaysSo(string method, string path)
    {
        using var document = await ReadDocumentAsync();

        var operation = document.RootElement.GetProperty("paths").GetProperty(path).GetProperty(method);

        operation.GetProperty("responses").TryGetProperty("422", out _).ShouldBeTrue($"{method} {path} declares no 422");
        operation.GetProperty("summary").GetString().ShouldNotBeNull().ShouldContain("orders.locked");
    }

    [Theory]
    [InlineData("put", "/api/v1/orders/{orderId}/payments/{paymentId}")]
    [InlineData("delete", "/api/v1/orders/{orderId}/payments/{paymentId}")]
    public async Task APaymentChangeSaysItCanBeRefusedForDroppingBelowTheRefunds(string method, string path)
    {
        using var document = await ReadDocumentAsync();

        var operation = document.RootElement.GetProperty("paths").GetProperty(path).GetProperty(method);

        operation.GetProperty("summary").GetString().ShouldNotBeNull().ShouldContain("orders.payment-below-refunds");
    }

    [Fact]
    public async Task RenamingOthersIsDocumentedAsA400AndNotA422()
    {
        using var document = await ReadDocumentAsync();

        var operation = document.RootElement.GetProperty("paths").GetProperty("/api/v1/order-expense-categories/{id}").GetProperty("put");

        operation.GetProperty("responses").TryGetProperty("422", out _).ShouldBeFalse("a rename of Others is a 400 on name");
        var summary = operation.GetProperty("summary").GetString().ShouldNotBeNull();
        summary.ShouldNotContain("422");
        summary.ShouldContain("The Others name can't change.");
    }

    [Theory]
    [InlineData("/api/v1/product-types")]
    [InlineData("/api/v1/payment-methods")]
    [InlineData("/api/v1/order-expense-categories")]
    public async Task CreatingAListEntryDeclaresThe409OfALostDeadlock(string path)
    {
        using var document = await ReadDocumentAsync();

        var operation = document.RootElement.GetProperty("paths").GetProperty(path).GetProperty("post");

        operation.GetProperty("responses").TryGetProperty("409", out _).ShouldBeTrue();
    }

    private static async Task<JsonDocument> ReadDocumentAsync()
    {
        await using var baseFactory = new CspsApiFactory();
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();
        using var response = await client.GetAsync(new Uri("/openapi/v1.json", UriKind.Relative), TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);
        return await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(TestContext.Current.CancellationToken), cancellationToken: TestContext.Current.CancellationToken);
    }
}
