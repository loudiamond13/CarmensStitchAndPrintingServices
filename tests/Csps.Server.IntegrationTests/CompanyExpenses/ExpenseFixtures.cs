using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Ports;
using Csps.Domain.Expenses;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.CompanyExpenses;

/// <summary>Builds company expense requests and reads the answers (Phase 6 write path tests).</summary>
internal static class ExpenseFixtures
{
    /// <summary>The company expenses route.</summary>
    public const string Route = "/api/v1/company-expenses";

    /// <summary>The id of the seeded Supplies category.</summary>
    public static readonly Guid SuppliesId = ExpenseCategorySeed.Rows.Single(row => row.Name == "Supplies").Id;

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>A body the server accepts, as a dictionary so a test can override one member.</summary>
    /// <param name="categoryId">The category.</param>
    /// <param name="paidById">The payer.</param>
    /// <param name="date">The expense date.</param>
    /// <returns>The body members.</returns>
    public static Dictionary<string, object?> ValidBody(Guid categoryId, Guid paidById, DateOnly date) => new()
    {
        ["date"] = date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
        ["categoryId"] = categoryId,
        ["description"] = "Thread and needles",
        ["amount"] = 640.00m,
        ["paidByUserId"] = paidById,
        ["notes"] = null,
    };

    /// <summary>Posts an expense with an idempotency key.</summary>
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

    /// <summary>Puts an edit of one expense.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The expense id.</param>
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

    /// <summary>Soft-deletes one expense.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The expense id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Restores one soft-deleted expense with an idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The expense id.</param>
    /// <param name="idempotencyKey">The key; a fresh one when null, none at all when <paramref name="withKey"/> is false.</param>
    /// <param name="withKey">False to send no key.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> RestoreAsync(HttpClient client, string? accessToken, Guid id, Guid? idempotencyKey = null, bool withKey = true)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/restore", accessToken);
        if (withKey)
        {
            request.Headers.Add(AuthClient.IdempotencyKeyHeader, (idempotencyKey ?? Guid.NewGuid()).ToString("D"));
        }

        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Lists soft-deleted expenses with a raw query string.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The query string without the question mark.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ListDeletedAsync(HttpClient client, string? accessToken, string query = "")
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(query.Length == 0 ? $"{Route}/deleted" : $"{Route}/deleted?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Lists soft-deleted expenses and reads a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The query string without the question mark.</param>
    /// <returns>The page.</returns>
    public static async Task<DeletedListPage> ReadDeletedPageAsync(HttpClient client, string accessToken, string query = "")
    {
        using var response = await ListDeletedAsync(client, accessToken, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return JsonSerializer.Deserialize<DeletedListPage>(text, Web).ShouldNotBeNull();
    }

    /// <summary>Builds the edit form an unchanged copy of an expense would send, so a test can override one member.</summary>
    /// <param name="detail">The expense as the API returned it.</param>
    /// <returns>The body members, with the version the detail carried.</returns>
    public static Dictionary<string, object?> BodyFrom(JsonElement detail) => new()
    {
        ["date"] = detail.GetProperty("date").GetString(),
        ["categoryId"] = detail.GetProperty("category").GetProperty("id").GetGuid(),
        ["description"] = detail.GetProperty("description").GetString(),
        ["amount"] = detail.GetProperty("amount").GetDecimal(),
        ["paidByUserId"] = detail.GetProperty("paidBy").GetProperty("id").GetGuid(),
        ["notes"] = IsNull(detail, "notes") ? null : detail.GetProperty("notes").GetString(),
        ["version"] = detail.GetProperty("version").GetString(),
    };

    /// <summary>Reads one expense.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The expense id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one expense and returns the 200 body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="id">The expense id.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadDetailAsync(HttpClient client, string accessToken, Guid id)
    {
        using var response = await GetAsync(client, accessToken, id);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        return document.RootElement.Clone();
    }

    /// <summary>Posts an expense, expects a 201 and returns its body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="body">The body.</param>
    /// <returns>The JSON body of the created expense.</returns>
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

    /// <summary>
    /// Writes one expense straight to the database. A context from <see cref="CspsDatabase.CreateContext"/> carries no record-stamp
    /// interceptor, so the recorder, the recorded time and the delete marker are set as given.
    /// </summary>
    /// <param name="database">The test database.</param>
    /// <param name="seed">The expense to write.</param>
    /// <returns>The new expense id.</returns>
    public static async Task<Guid> SeedAsync(CspsDatabase database, ExpenseSeed seed)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(seed);
        var created = CompanyExpense.Create(seed.Date, seed.CategoryId, seed.Description, seed.Amount, seed.PaidById, seed.Notes, seed.Date, seed.RecordedAtUtc);
        var expense = created.Value;
        await using var context = database.CreateContext();
        context.CompanyExpenses.Add(expense);
        var entry = context.Entry(expense);
        entry.Property(row => row.CreatedById).CurrentValue = seed.RecordedById;
        entry.Property(row => row.CreatedAtUtc).CurrentValue = seed.RecordedAtUtc;
        if (seed.Deleted)
        {
            entry.Property(row => row.DeletedAtUtc).CurrentValue = seed.DeletedAtUtc ?? seed.RecordedAtUtc.AddMinutes(1);
            entry.Property(row => row.DeletedById).CurrentValue = seed.DeletedById ?? seed.RecordedById;
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return expense.Id;
    }

    /// <summary>Lists expenses with a raw query string.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="query">The query string without the question mark.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ListAsync(HttpClient client, string? accessToken, string query = "")
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get(query.Length == 0 ? Route : $"{Route}?{query}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the month KPIs.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> KpisResponseAsync(HttpClient client, string? accessToken)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{Route}/kpis", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads the month KPIs and expects a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <returns>The KPIs.</returns>
    public static async Task<ExpenseKpis> ReadKpisAsync(HttpClient client, string accessToken)
    {
        using var response = await KpisResponseAsync(client, accessToken);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return JsonSerializer.Deserialize<ExpenseKpis>(text, Web).ShouldNotBeNull();
    }

    /// <summary>Lists expenses and reads a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The query string without the question mark.</param>
    /// <returns>The page.</returns>
    public static async Task<ExpensePage> ReadPageAsync(HttpClient client, string accessToken, string query = "")
    {
        using var response = await ListAsync(client, accessToken, query);
        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, text);
        return JsonSerializer.Deserialize<ExpensePage>(text, Web).ShouldNotBeNull();
    }
}

/// <summary>One expense to write straight to the database.</summary>
/// <param name="Date">The expense date.</param>
/// <param name="PaidById">The payer.</param>
/// <param name="RecordedById">The recorder; null reads as System.</param>
/// <param name="RecordedAtUtc">When it was recorded.</param>
/// <param name="CategoryId">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount.</param>
/// <param name="Notes">The notes.</param>
/// <param name="Deleted">True to write it soft-deleted.</param>
/// <param name="DeletedById">Who deleted it; the recorder when null.</param>
/// <param name="DeletedAtUtc">When it was deleted; a minute after it was recorded when null.</param>
internal sealed record ExpenseSeed(
    DateOnly Date,
    Guid PaidById,
    Guid? RecordedById,
    DateTimeOffset RecordedAtUtc,
    Guid CategoryId,
    string Description,
    decimal Amount,
    string? Notes = null,
    bool Deleted = false,
    Guid? DeletedById = null,
    DateTimeOffset? DeletedAtUtc = null);

/// <summary>The category of a listed expense.</summary>
/// <param name="Id">The category id.</param>
/// <param name="Name">The name.</param>
/// <param name="Tone">The tone.</param>
/// <param name="Retired">True when retired.</param>
internal sealed record ListedCategory(Guid Id, string Name, string Tone, bool Retired);

/// <summary>A person named on a listed expense.</summary>
/// <param name="Id">The account id.</param>
/// <param name="Name">The name, first then last.</param>
/// <param name="FormerStaff">True when the account was deleted.</param>
internal sealed record ListedActor(Guid Id, string Name, bool FormerStaff);

/// <summary>One row of the expense list as the API returns it.</summary>
/// <param name="Id">The expense id.</param>
/// <param name="Date">The expense date.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount.</param>
/// <param name="PaidBy">The payer.</param>
/// <param name="RecordedBy">The recorder; null reads as System.</param>
/// <param name="CanEdit">True when the caller may edit it.</param>
internal sealed record ListedExpense(
    Guid Id,
    DateOnly Date,
    ListedCategory Category,
    string Description,
    decimal Amount,
    ListedActor PaidBy,
    ListedActor? RecordedBy,
    bool CanEdit);

/// <summary>One row of the deleted-expense list as the API returns it.</summary>
/// <param name="Id">The expense id.</param>
/// <param name="DeletedAt">When it was deleted.</param>
/// <param name="DeletedBy">Who deleted it; null reads as System.</param>
/// <param name="Date">The expense date.</param>
/// <param name="Category">The category.</param>
/// <param name="Description">What it was for.</param>
/// <param name="Amount">The amount.</param>
/// <param name="PaidBy">The payer.</param>
internal sealed record DeletedListItem(
    Guid Id,
    DateTimeOffset DeletedAt,
    ListedActor? DeletedBy,
    DateOnly Date,
    ListedCategory Category,
    string Description,
    decimal Amount,
    ListedActor PaidBy);

/// <summary>One page of the deleted-expense list as the API returns it.</summary>
/// <param name="Items">The rows.</param>
/// <param name="Total">All deleted expenses that match.</param>
/// <param name="Page">The page number.</param>
/// <param name="PageSize">The page size.</param>
internal sealed record DeletedListPage(IReadOnlyList<DeletedListItem> Items, int Total, int Page, int PageSize);

/// <summary>One page of the expense list as the API returns it.</summary>
/// <param name="Items">The rows.</param>
/// <param name="Total">All matching rows.</param>
/// <param name="Page">The page number.</param>
/// <param name="PageSize">The page size.</param>
/// <param name="PeriodTotal">The sum over every matching row.</param>
/// <param name="From">The first day of the window.</param>
/// <param name="To">The last day of the window.</param>
/// <param name="Today">The business today.</param>
internal sealed record ExpensePage(
    IReadOnlyList<ListedExpense> Items,
    int Total,
    int Page,
    int PageSize,
    decimal PeriodTotal,
    DateOnly From,
    DateOnly To,
    DateOnly Today);

/// <summary>One month of the KPI answer.</summary>
/// <param name="Month">The first day of the month.</param>
/// <param name="Total">The sum of the month's expenses.</param>
/// <param name="Count">How many expenses.</param>
internal sealed record ListedMonthKpi(DateOnly Month, decimal Total, int Count);

/// <summary>The top category of the KPI answer.</summary>
/// <param name="Category">The category.</param>
/// <param name="Total">Its total this month.</param>
/// <param name="SharePercent">Its share of this month's total, in whole percent.</param>
internal sealed record ListedTopCategory(ListedCategory Category, decimal Total, int SharePercent);

/// <summary>The KPI answer as the API returns it.</summary>
/// <param name="Today">The business today.</param>
/// <param name="ThisMonth">This month.</param>
/// <param name="LastMonth">Last month.</param>
/// <param name="TopCategory">The top category this month; null when there is none.</param>
internal sealed record ExpenseKpis(DateOnly Today, ListedMonthKpi ThisMonth, ListedMonthKpi LastMonth, ListedTopCategory? TopCategory);
