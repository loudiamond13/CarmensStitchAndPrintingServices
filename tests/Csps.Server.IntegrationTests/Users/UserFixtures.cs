using System.Globalization;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>A staff account created for a roster test.</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name, ending in the test's tag.</param>
/// <param name="LastName">Family name, ending in the test's tag.</param>
/// <param name="Email">The sign-in email, containing the test's tag.</param>
/// <param name="Role">The role, <c>Admin</c> or <c>Manager</c>.</param>
internal sealed record SeededUser(Guid Id, string FirstName, string LastName, string Email, string Role);

/// <summary>The staff one roster test created. Every name and email carries <see cref="Tag"/>, so a search for the tag finds only this test's people.</summary>
/// <param name="Tag">The unique text in every name and email.</param>
/// <param name="Visible">The people a roster must list, in first-name order.</param>
/// <param name="Deleted">The soft-deleted person, who must never be listed.</param>
internal sealed record RosterSeed(string Tag, IReadOnlyList<SeededUser> Visible, SeededUser Deleted)
{
    /// <summary>Finds a seeded person by the start of their first name.</summary>
    /// <param name="firstName">The first name without the tag.</param>
    /// <returns>The person.</returns>
    public SeededUser Named(string firstName) => Visible.Single(user => user.FirstName.StartsWith(firstName, StringComparison.Ordinal));
}

/// <summary>One row of the roster as the API returns it.</summary>
/// <param name="Id">The account id.</param>
/// <param name="FirstName">Given name.</param>
/// <param name="LastName">Family name.</param>
/// <param name="Email">The sign-in email.</param>
/// <param name="Role">The role.</param>
/// <param name="Status">active, inactive or locked.</param>
/// <param name="InviteState">none, pending or expired.</param>
/// <param name="CreatedAt">When the account was created.</param>
internal sealed record ListedUser(Guid Id, string FirstName, string LastName, string Email, string Role, string Status, string InviteState, DateTimeOffset CreatedAt);

/// <summary>One page of the roster as the API returns it.</summary>
/// <param name="Items">The rows.</param>
/// <param name="Total">All matching rows.</param>
/// <param name="Page">The page number.</param>
/// <param name="PageSize">The page size.</param>
internal sealed record UserPage(IReadOnlyList<ListedUser> Items, int Total, int Page, int PageSize);

/// <summary>Creates named staff through the real services and reads the Users endpoints (Phase 5 roster tests).</summary>
internal static class UserFixtures
{
    /// <summary>The roster route.</summary>
    public const string Route = "/api/v1/users";

    private static readonly JsonSerializerOptions Web = new(JsonSerializerDefaults.Web);

    /// <summary>Makes a short unique text to put in every name and email of one test.</summary>
    /// <returns>Eight lowercase hex characters.</returns>
    public static string NewTag() => Guid.NewGuid().ToString("N")[..8];

    /// <summary>Creates one staff account whose names end in the tag.</summary>
    /// <param name="factory">The test host.</param>
    /// <param name="tag">The test's tag.</param>
    /// <param name="first">The first name before the tag.</param>
    /// <param name="last">The last name before the tag.</param>
    /// <param name="role">The role.</param>
    /// <param name="withPassword">False for an invited account with no password yet.</param>
    /// <returns>The account.</returns>
    public static async Task<SeededUser> CreateAsync(
        CspsApiFactory factory, string tag, string first, string last, string role = Roles.Manager, bool withPassword = true)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var firstName = first + tag;
        var lastName = last + tag;
        var email = string.Create(CultureInfo.InvariantCulture, $"u.{Guid.NewGuid():N}.{tag}@example.com");
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            var id = await accounts.CreateAsync(
                new NewUserAccount(email, firstName, lastName, role, withPassword ? $"Pw-{Guid.NewGuid():N}!x" : null),
                TestContext.Current.CancellationToken);
            return new SeededUser(id, firstName, lastName, email, role);
        }
    }

    /// <summary>Gives an account an invitation link that works, or one that ran out.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <param name="expired">True for a link whose time has passed.</param>
    /// <returns>A task that completes when the link is saved.</returns>
    public static async Task AddInvitationAsync(CspsDatabase database, Guid userId, bool expired)
    {
        ArgumentNullException.ThrowIfNull(database);
        var issued = TimeProvider.System.GetUtcNow().AddDays(expired ? -10 : 0);
        await using var context = database.CreateContext();
        context.AccountTokens.Add(AccountToken.Create(userId, AccountTokenPurpose.Invitation, RandomNumberGenerator.GetBytes(32), issued, TimeSpan.FromDays(7)));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Creates ten people in the shapes the roster must tell apart, plus one deleted person: Managers Ana, Dina, Gina (locked) and Mae
    /// (failed-password lockout, which is not Locked); Admins Bea, Carla, Eli, Fe (deactivated and also locked, so Inactive wins),
    /// Hal (invitation works) and Ivo (invitation ran out); and Jun, deleted.
    /// </summary>
    /// <param name="factory">The test host.</param>
    /// <param name="database">The test database.</param>
    /// <returns>The people.</returns>
    public static async Task<RosterSeed> SeedRosterAsync(CspsApiFactory factory, CspsDatabase database)
    {
        ArgumentNullException.ThrowIfNull(factory);
        var tag = NewTag();
        var ana = await CreateAsync(factory, tag, "Ana", "Abad");
        var bea = await CreateAsync(factory, tag, "Bea", "Bautista", Roles.Admin);
        var carla = await CreateAsync(factory, tag, "Carla", "Cruz", Roles.Admin);
        var dina = await CreateAsync(factory, tag, "Dina", "Dizon");
        var eli = await CreateAsync(factory, tag, "Eli", "Esteban", Roles.Admin);
        var fe = await CreateAsync(factory, tag, "Fe", "Flores", Roles.Admin);
        var gina = await CreateAsync(factory, tag, "Gina", "Garcia");
        var hal = await CreateAsync(factory, tag, "Hal", "Honrado", Roles.Admin, withPassword: false);
        var ivo = await CreateAsync(factory, tag, "Ivo", "Ilagan", Roles.Admin, withPassword: false);
        var mae = await CreateAsync(factory, tag, "Mae", "Mendoza");
        var jun = await CreateAsync(factory, tag, "Jun", "Javier", Roles.Admin);

        await AuthClient.DeactivateAsync(factory, fe.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, fe.Id);
        await AccountStateFixtures.ManagerLockAsync(factory, gina.Id);
        await AuthClient.LockAsync(factory, mae.Id);
        await AddInvitationAsync(database, hal.Id, expired: false);
        await AddInvitationAsync(database, ivo.Id, expired: true);
        await AccountStateFixtures.MarkDeletedAsync(factory, jun.Id);

        return new RosterSeed(tag, [ana, bea, carla, dina, eli, fe, gina, hal, ivo, mae], jun);
    }

    /// <summary>Sets who created and who last changed an account, as the Manager screens would have recorded.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account to stamp.</param>
    /// <param name="createdById">Who created it; null reads as System.</param>
    /// <param name="updatedById">Who last changed it; null reads as System.</param>
    /// <param name="updatedAt">When it was last changed; null if never.</param>
    /// <returns>A task that completes when the stamp is saved.</returns>
    public static async Task StampAsync(CspsDatabase database, Guid userId, Guid? createdById, Guid? updatedById, DateTimeOffset? updatedAt)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var changed = await context.Users.Where(user => user.Id == userId).ExecuteUpdateAsync(
            set => set
                .SetProperty(user => user.CreatedById, createdById)
                .SetProperty(user => user.UpdatedById, updatedById)
                .SetProperty(user => user.UpdatedAtUtc, updatedAt),
            TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }

    /// <summary>Puts an email change on hold for an account, as a request would.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="userId">The account.</param>
    /// <param name="pendingEmail">The address waiting for confirmation.</param>
    /// <returns>A task that completes when the address is saved.</returns>
    public static async Task SetPendingEmailAsync(CspsDatabase database, Guid userId, string pendingEmail)
    {
        ArgumentNullException.ThrowIfNull(database);
        await using var context = database.CreateContext();
        var changed = await context.Users.Where(user => user.Id == userId).ExecuteUpdateAsync(
            set => set.SetProperty(user => user.PendingEmail, pendingEmail), TestContext.Current.CancellationToken);
        changed.ShouldBe(1);
    }

    /// <summary>Posts a lifecycle action (<c>deactivate</c>, <c>activate</c>) for one person with a fresh idempotency key.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The account id.</param>
    /// <param name="action">The route segment after the id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> ActionAsync(HttpClient client, string? accessToken, Guid id, string action)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/{action}", accessToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Adds a staff member through <c>POST /api/v1/users</c> with a Manager-set temporary password, so the address stays unproved until the first correct code (D-49).</summary>
    /// <param name="client">The client.</param>
    /// <param name="managerToken">The Manager's bearer token.</param>
    /// <param name="email">The new person's address.</param>
    /// <param name="temporaryPassword">The temporary password.</param>
    /// <returns>The new account id.</returns>
    public static async Task<Guid> CreateWithTemporaryPasswordAsync(HttpClient client, string managerToken, string email, string temporaryPassword)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, Route, managerToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new
        {
            firstName = "Tia",
            lastName = "Temporal",
            email,
            role = Roles.Admin,
            access = "temporary-password",
            temporaryPassword,
        });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.Created, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return body.RootElement.GetProperty("id").GetGuid();
    }

    /// <summary>Has a Manager set a temporary password for a colleague (<c>POST /api/v1/users/{id}/temporary-password</c>) and expects it to work.</summary>
    /// <param name="client">The client.</param>
    /// <param name="managerToken">The Manager's bearer token.</param>
    /// <param name="id">The colleague's account id.</param>
    /// <param name="temporaryPassword">The temporary password.</param>
    /// <returns>A task that completes when the password is set.</returns>
    public static async Task SetTemporaryPasswordAsync(HttpClient client, string managerToken, Guid id, string temporaryPassword)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Post, $"{Route}/{id:D}/temporary-password", managerToken);
        request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
        request.Content = JsonContent.Create(new { temporaryPassword });
        using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    /// <summary>Deletes one person (<c>DELETE /api/v1/users/{id}</c>). The call takes no key and no version.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The account id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> DeleteAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Create(HttpMethod.Delete, $"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one person's detail.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token; none when null.</param>
    /// <param name="id">The account id.</param>
    /// <returns>The response. The caller disposes it.</returns>
    public static async Task<HttpResponseMessage> GetAsync(HttpClient client, string? accessToken, Guid id)
    {
        ArgumentNullException.ThrowIfNull(client);
        using var request = ApiRequests.Get($"{Route}/{id:D}", accessToken);
        return await client.SendAsync(request, TestContext.Current.CancellationToken);
    }

    /// <summary>Reads one person's detail and returns the 200 body.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="id">The account id.</param>
    /// <returns>The JSON body.</returns>
    public static async Task<JsonElement> ReadDetailAsync(HttpClient client, string accessToken, Guid id)
    {
        using var response = await GetAsync(client, accessToken, id);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        return document.RootElement.Clone();
    }

    /// <summary>Lists the roster with a raw query string.</summary>
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

    /// <summary>Lists the roster and reads a 200 answer.</summary>
    /// <param name="client">The client.</param>
    /// <param name="accessToken">The bearer token.</param>
    /// <param name="query">The query string without the question mark.</param>
    /// <returns>The page.</returns>
    public static async Task<UserPage> ReadPageAsync(HttpClient client, string accessToken, string query = "")
    {
        using var response = await ListAsync(client, accessToken, query);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK, await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        return (await response.Content.ReadFromJsonAsync<UserPage>(Web, TestContext.Current.CancellationToken)).ShouldNotBeNull();
    }
}
