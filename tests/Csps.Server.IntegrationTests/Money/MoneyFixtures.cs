using System.Text.Json;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;

namespace Csps.Server.IntegrationTests.Money;

/// <summary>Staff, money rows and reads for the staff money endpoint tests (MONEY-01).</summary>
internal static class MoneyFixtures
{
    /// <summary>The route that answers the signed-in person's own money on hand.</summary>
    public const string MeRoute = "/api/v1/staff-money/me";

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>Starts a staff account with a live session and gives it a chosen name.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="database">The test database.</param>
    /// <param name="role">The role, <c>Admin</c> or <c>Manager</c>.</param>
    /// <param name="firstName">The first name to store.</param>
    /// <param name="lastName">The last name to store.</param>
    /// <returns>The account with its session and token.</returns>
    public static async Task<StartedSession> StartStaffAsync(
        WebApplicationFactory<Program> factory, CspsDatabase database, string role, string firstName, string lastName)
    {
        ArgumentNullException.ThrowIfNull(factory);
        ArgumentNullException.ThrowIfNull(database);
        var session = await TestSessions.StartAsync(factory, role);
        await using var context = database.CreateContext();
        await context.Users.Where(user => user.Id == session.UserId)
            .ExecuteUpdateAsync(
                set => set.SetProperty(user => user.FirstName, firstName).SetProperty(user => user.LastName, lastName),
                TestContext.Current.CancellationToken);
        return session;
    }

    /// <summary>Gives a person a payment on a new order, so the payment counts as money they received.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="receiverId">Who received the payment.</param>
    /// <param name="number">A unique order number such as <c>ORD-2026-0001</c>.</param>
    /// <param name="amount">The payment amount.</param>
    /// <param name="date">The payment date.</param>
    /// <param name="now">The instant the order is written at.</param>
    /// <returns>The new order id.</returns>
    public static Task<Guid> SeedPaymentAsync(CspsDatabase database, Guid receiverId, string number, decimal amount, DateOnly date, DateTimeOffset now) =>
        OrderSeeding.AddAsync(
            database,
            new SeedOrder(number, Csps.Domain.Orders.OrderStatus.Pending) { Total = 50000.00m, Payments = [new SeedMoney(date, amount)] },
            receiverId,
            now);

    /// <summary>Writes one company expense paid by a person.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="payerId">Who paid it.</param>
    /// <param name="recorderId">Who recorded it.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The expense date.</param>
    /// <param name="now">The instant it was recorded at.</param>
    /// <returns>The new expense id.</returns>
    public static Task<Guid> SeedCompanyExpenseAsync(CspsDatabase database, Guid payerId, Guid recorderId, decimal amount, DateOnly date, DateTimeOffset now) =>
        ExpenseFixtures.SeedAsync(
            database,
            new ExpenseSeed(date, payerId, recorderId, now, ExpenseFixtures.SuppliesId, "Thread and needles", amount));

    /// <summary>Soft-deletes an order so its money stops counting.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="orderId">The order.</param>
    /// <param name="now">The delete instant.</param>
    /// <returns>A task that completes once the order is marked.</returns>
    public static async Task DeleteOrderAsync(CspsDatabase database, Guid orderId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        await context.Orders.Where(row => row.Id == orderId)
            .ExecuteUpdateAsync(set => set.SetProperty(row => row.DeletedAtUtc, now), TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the caller's own money on hand.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetMeAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(MeRoute, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the caller's own money on hand and expects a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadMeAsync(HttpClient client, string accessToken)
    {
        using var response = await GetMeAsync(client, accessToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return JsonSerializer.Deserialize<JsonElement>(text, Web);
    }

    /// <summary>Reads the caller's balance from a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The balance.</returns>
    public static async Task<decimal> ReadBalanceAsync(HttpClient client, string accessToken) =>
        (await ReadMeAsync(client, accessToken)).GetProperty("balance").GetDecimal();
}
