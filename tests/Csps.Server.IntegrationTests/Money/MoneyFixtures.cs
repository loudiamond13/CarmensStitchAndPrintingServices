using System.Text.Json;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

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

    /// <summary>Locks an account as a Manager would, so the person can no longer sign in.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <param name="now">The lock instant.</param>
    /// <returns>A task that completes once the account is marked.</returns>
    public static async Task LockAccountAsync(CspsDatabase database, Guid userId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        await context.Users.Where(user => user.Id == userId)
            .ExecuteUpdateAsync(set => set.SetProperty(user => user.ManagerLockedAtUtc, now), TestContext.Current.CancellationToken);
    }

    /// <summary>Takes away a person's password and email confirmation, as if they had not finished first sign-in set-up.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <returns>A task that completes once the account is marked.</returns>
    public static async Task MakeNotSetUpAsync(CspsDatabase database, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        await context.Users.Where(user => user.Id == userId)
            .ExecuteUpdateAsync(
                set => set.SetProperty(user => user.PasswordHash, (string?)null).SetProperty(user => user.EmailConfirmed, false),
                TestContext.Current.CancellationToken);
    }

    /// <summary>Deactivates an account.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <returns>A task that completes once the account is marked.</returns>
    public static async Task DeactivateAccountAsync(CspsDatabase database, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        await context.Users.Where(user => user.Id == userId)
            .ExecuteUpdateAsync(set => set.SetProperty(user => user.IsActive, false), TestContext.Current.CancellationToken);
    }

    /// <summary>Soft-deletes an account, keeping its role.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <param name="now">The delete instant.</param>
    /// <returns>A task that completes once the account is marked.</returns>
    public static async Task DeleteAccountAsync(CspsDatabase database, Guid userId, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        await context.Users.Where(user => user.Id == userId)
            .ExecuteUpdateAsync(set => set.SetProperty(user => user.DeletedAtUtc, now).SetProperty(user => user.IsActive, false), TestContext.Current.CancellationToken);
    }

    /// <summary>Reads every transfer row, deleted or not, oldest first.</summary>
    /// <param name="database">The test database.</param>
    /// <returns>The stored transfers.</returns>
    public static async Task<IReadOnlyList<Csps.Domain.Money.MoneyTransfer>> ReadTransfersAsync(CspsDatabase database)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        return await context.Set<Csps.Domain.Money.MoneyTransfer>().AsNoTracking().OrderBy(row => row.CreatedAtUtc)
            .ToListAsync(TestContext.Current.CancellationToken);
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

    /// <summary>The route that records a transfer.</summary>
    public const string TransfersRoute = "/api/v1/money-transfers";

    /// <summary>A transfer body the server accepts, as a dictionary so a test can override or add one member.</summary>
    /// <param name="toUserId">The recipient.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="note">The note; none when null.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> TransferBody(Guid toUserId, decimal amount, DateOnly date, string? note = null) => new()
    {
        ["toUserId"] = toUserId,
        ["amount"] = amount,
        ["transferDate"] = date.ToString("yyyy-MM-dd", System.Globalization.CultureInfo.InvariantCulture),
        ["note"] = note,
    };

    /// <summary>Posts a transfer body with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostTransferAsync(HttpClient client, string? accessToken, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, TransfersRoute, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = System.Net.Http.Json.JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a transfer built from its parts with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="toUserId">The recipient.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="note">The note; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> PostTransferAsync(
        HttpClient client, string? accessToken, Guid toUserId, decimal amount, DateOnly date, string? note = null, Guid? idempotencyKey = null) =>
        PostTransferAsync(client, accessToken, TransferBody(toUserId, amount, date, note), idempotencyKey);

    /// <summary>The route that records a hand-over.</summary>
    public const string HandoversRoute = "/api/v1/money-transfers/handovers";

    /// <summary>The route that lists who can receive a transfer.</summary>
    public const string RecipientsRoute = "/api/v1/money-transfers/recipients";

    /// <summary>A hand-over body the server accepts, as a dictionary so a test can override or add one member.</summary>
    /// <param name="fromUserId">The former staff member who holds the money.</param>
    /// <param name="toUserId">The coworker who receives it.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="note">The note; none when null.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> HandoverBody(Guid fromUserId, Guid toUserId, decimal amount, DateOnly date, string? note = null)
    {
        var body = TransferBody(toUserId, amount, date, note);
        body["fromUserId"] = fromUserId;
        return body;
    }

    /// <summary>Posts a hand-over body with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="body">The body; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> PostHandoverAsync(HttpClient client, string? accessToken, object? body, Guid? idempotencyKey = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, HandoversRoute, accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        if (body is not null)
        {
            request.Content = System.Net.Http.Json.JsonContent.Create(body);
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Posts a hand-over built from its parts with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="fromUserId">The former staff member who holds the money.</param>
    /// <param name="toUserId">The coworker who receives it.</param>
    /// <param name="amount">The amount.</param>
    /// <param name="date">The transfer date.</param>
    /// <param name="note">The note; none when null.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static Task<HttpResponseMessage> PostHandoverAsync(
        HttpClient client, string? accessToken, Guid fromUserId, Guid toUserId, decimal amount, DateOnly date, string? note = null, Guid? idempotencyKey = null) =>
        PostHandoverAsync(client, accessToken, HandoverBody(fromUserId, toUserId, amount, date, note), idempotencyKey);

    /// <summary>Reads one person's money on hand straight from the read port, so it works for people who can no longer sign in.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="userId">The person.</param>
    /// <returns>The balance.</returns>
    public static async Task<decimal> ReadBalanceByIdAsync(WebApplicationFactory<Program> factory, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var reader = scope.ServiceProvider.GetRequiredService<Csps.Application.Ports.IStaffMoneyReader>();
            var sums = await reader.GetSumsAsync([userId], TestContext.Current.CancellationToken);
            return sums.Single(row => row.UserId == userId).Balance();
        }
    }

    /// <summary>Reads who can receive a transfer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetRecipientsAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(RecipientsRoute, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Gives an account a role, as the dev seed or a Manager would.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <param name="roleName">The role name, <c>Admin</c> or <c>Manager</c>.</param>
    /// <returns>A task that completes once the role is linked.</returns>
    public static async Task AddRoleAsync(CspsDatabase database, Guid userId, string roleName)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var roleId = await context.Roles.Where(role => role.Name == roleName).Select(role => role.Id).SingleAsync(TestContext.Current.CancellationToken);
        context.UserRoles.Add(new Microsoft.AspNetCore.Identity.IdentityUserRole<Guid> { UserId = userId, RoleId = roleId });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the audit entries of one action written by one actor, oldest first. The log is append-only, so a test scopes by its own actor.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="action">The action code.</param>
    /// <param name="actorUserId">Who did it.</param>
    /// <returns>The entries.</returns>
    public static async Task<IReadOnlyList<Csps.Domain.Auditing.AuditEntry>> ReadAuditAsync(CspsDatabase database, string action, Guid actorUserId)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        return await context.AuditLog.AsNoTracking().Where(entry => entry.Action == action && entry.ActorUserId == actorUserId).OrderBy(entry => entry.Id)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>Reads a 400 answer and returns the messages under one field.</summary>
    /// <param name="response">The response; it must be a 400.</param>
    /// <param name="field">The field name.</param>
    /// <returns>The messages under the field; empty when it has none.</returns>
    public static async Task<IReadOnlyList<string>> ReadFieldErrorsAsync(HttpResponseMessage response, string field)
    {
        ArgumentNullException.ThrowIfNull(response);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.BadRequest, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        return ExpenseFixtures.FieldErrors(problem, field);
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

    /// <summary>The route that answers the signed-in person's own ledger.</summary>
    public const string LedgerRoute = "/api/v1/staff-money/me/ledger";

    /// <summary>Reads one page of the caller's own ledger.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The raw query string without the question mark, such as <c>page=2&amp;pageSize=10</c>; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetLedgerAsync(HttpClient client, string? accessToken, string? query = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(query is null ? LedgerRoute : $"{LedgerRoute}?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one page of the caller's own ledger and expects a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The raw query string without the question mark; none when null.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadLedgerAsync(HttpClient client, string accessToken, string? query = null)
    {
        using var response = await GetLedgerAsync(client, accessToken, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return JsonSerializer.Deserialize<JsonElement>(text, Web);
    }

    /// <summary>The route that lists every staff member's money on hand.</summary>
    public const string StaffBalancesRoute = "/api/v1/staff-money";

    /// <summary>Reads everyone's money on hand.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetStaffBalancesAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(StaffBalancesRoute, accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one page of the transfer list.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The raw query string without the question mark; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetTransferListAsync(HttpClient client, string? accessToken, string? query = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(query is null ? TransfersRoute : $"{TransfersRoute}?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one named person's money on hand.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="userId">The person asked about.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetStaffMoneyAsync(HttpClient client, string? accessToken, Guid userId)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{StaffBalancesRoute}/{userId:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one page of one named person's ledger.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="userId">The person asked about.</param>
    /// <param name="query">The raw query string without the question mark; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetStaffLedgerAsync(HttpClient client, string? accessToken, Guid userId, string? query = null)
    {
        ArgumentNullException.ThrowIfNull(client);
        var path = $"{StaffBalancesRoute}/{userId:D}/ledger";
        using var request = ApiRequests.Get(query is null ? path : $"{path}?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the caller's balance from a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The balance.</returns>
    public static async Task<decimal> ReadBalanceAsync(HttpClient client, string accessToken) =>
        (await ReadMeAsync(client, accessToken)).GetProperty("balance").GetDecimal();
}
