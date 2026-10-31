using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Csps.Application.Common;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Auth;
using Csps.Server.IntegrationTests.Authorization;
using Csps.Server.IntegrationTests.CompanyExpenses;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Users;

/// <summary>D-32, D-37, T-07-23, T-07-24, CWE-284: the Legacy / unassigned holder exists in every database but is never listed, chosen, changed or signed in.</summary>
public sealed class LegacyHolderHiddenTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PayerRefusal = "This person can't be chosen because their account isn't active. Choose someone else.";
    private const string UserRoutePrefix = "/api/v1/users/{id:guid}";

    [Theory]
    [InlineData(Roles.Admin)]
    [InlineData(Roles.Manager)]
    public async Task TheStaffLookupNeverListsTheHolder(string role)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var caller = await TestSessions.StartAsync(factory, role);
        await HolderExistsAsync(database);

        using var response = await client.SendAsync(ApiRequests.Get("/api/v1/staff", caller.AccessToken), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        document.RootElement.EnumerateArray().Select(item => item.GetProperty("id").GetGuid()).ShouldNotContain(LegacyHolder.Id);
        body.ShouldNotContain(LegacyHolder.DisplayName);
    }

    [Fact]
    public async Task TheHolderRowComesBackAfterATestReset()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            await own.ResetAsync();

            await HolderExistsAsync(own);
        }
    }

    [Fact]
    public async Task TheRosterNeverListsOrCountsTheHolder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        await HolderExistsAsync(database);
        int others;
        await using (var context = database.CreateContext())
        {
            others = await context.Users.AsNoTracking().CountAsync(user => user.DeletedAtUtc == null && user.Id != LegacyHolder.Id, TestContext.Current.CancellationToken);
        }

        var everyone = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "pageSize=100");
        var inactive = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "status=inactive");
        var byName = await UserFixtures.ReadPageAsync(client, manager.AccessToken, "q=Legacy");

        everyone.Total.ShouldBe(others);
        everyone.Items.Select(item => item.Id).ShouldNotContain(LegacyHolder.Id);
        inactive.Items.Select(item => item.Id).ShouldNotContain(LegacyHolder.Id);
        byName.Items.Select(item => item.Id).ShouldNotContain(LegacyHolder.Id);
    }

    [Fact]
    public async Task ReadingTheHolderByIdAnswers404LikeAnUnknownId()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var holder = await UserFixtures.GetAsync(client, manager.AccessToken, LegacyHolder.Id);
        using var unknown = await UserFixtures.GetAsync(client, manager.AccessToken, Guid.NewGuid());

        holder.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        unknown.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task TheAuditPeopleListNeverHasTheHolder()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);

        using var response = await client.SendAsync(ApiRequests.Get("/api/v1/audit-log/people", manager.AccessToken), TestContext.Current.CancellationToken);

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, body);
        using var document = JsonDocument.Parse(body);
        document.RootElement.EnumerateArray().Select(person => person.GetProperty("id").GetGuid()).ShouldNotContain(LegacyHolder.Id);
    }

    [Fact]
    public async Task EveryUserActionAimedAtTheHolderIsRefusedAndLeavesTheRowUnchanged()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var routes = AuthorizationMatrix.Rows.Where(row => row.RoutePattern.StartsWith(UserRoutePrefix, StringComparison.Ordinal)).ToList();
        routes.Count.ShouldBeGreaterThanOrEqualTo(11);
        var before = await SnapshotAsync(database);

        foreach (var route in routes)
        {
            var path = "/api/v1/users/" + LegacyHolder.Id.ToString("D") + route.RoutePattern[UserRoutePrefix.Length..];
            using var request = ApiRequests.Create(route.RequestMethod, path, manager.AccessToken);
            if (route.RequestMethod != HttpMethod.Get)
            {
                request.Headers.Add(AuthClient.IdempotencyKeyHeader, Guid.NewGuid().ToString("D"));
            }

            request.Content = BodyFor(route);

            using var response = await client.SendAsync(request, TestContext.Current.CancellationToken);

            response.StatusCode.ShouldBe(HttpStatusCode.NotFound, $"{route.Method} {path}");
            (await SnapshotAsync(database)).ShouldBe(before, $"{route.Method} {path} changed the holder");
        }
    }

    [Fact]
    public async Task TheHolderCannotBeNamedAsAPayerAndFailsTheCanPayCheck()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var today = await ExpenseFixtures.TodayAsync(factory);
        var body = ExpenseFixtures.ValidBody(ExpenseFixtures.SuppliesId, LegacyHolder.Id, today);

        using var response = await ExpenseFixtures.PostAsync(client, manager.AccessToken, body);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        ExpenseFixtures.ErrorFields(problem).ShouldBe(["paidByUserId"]);
        ExpenseFixtures.FieldErrors(problem, "paidByUserId").ShouldBe([PayerRefusal]);

        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var directory = scope.ServiceProvider.GetRequiredService<IStaffDirectory>();
            var state = (await directory.GetStaffStateAsync(LegacyHolder.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            state.CanPay.ShouldBeFalse();
            state.Name.ShouldBe(LegacyHolder.DisplayName);
        }
    }

    [Fact]
    public async Task TheHolderCannotSignInOrBeFoundAsAnAccount()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            (await accounts.FindByIdAsync(LegacyHolder.Id, TestContext.Current.CancellationToken)).ShouldBeNull();
            (await accounts.CheckPasswordAsync(LegacyHolder.Id, $"Pw-{Guid.NewGuid():N}!x", TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
        }
    }

    [Fact]
    public async Task AnAuditEntryThatNamesTheHolderStillShowsLegacySlashUnassignedAndNotFormerStaff()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        var manager = await TestSessions.StartAsync(factory, Roles.Manager);
        var reference = Guid.NewGuid().ToString("N");
        await using (var context = database.CreateContext())
        {
            context.AuditLog.Add(AuditEntry.Create(
                TimeProvider.System.GetUtcNow().AddMinutes(-1), LegacyHolder.Id, AuditActions.UserDeactivated, "User", AuditKey.Of(LegacyHolder.Id), null, null, reference, null));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        using var response = await client.SendAsync(ApiRequests.Get("/api/v1/audit-log?pageSize=100", manager.AccessToken), TestContext.Current.CancellationToken);

        var text = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.StatusCode.ShouldBe(HttpStatusCode.OK, text);
        using var document = JsonDocument.Parse(text);
        var entry = document.RootElement.GetProperty("items").EnumerateArray().Single(item => item.GetProperty("reference").GetString() == reference);
        var by = entry.GetProperty("doneBy").GetProperty("person");
        by.GetProperty("id").GetGuid().ShouldBe(LegacyHolder.Id);
        by.GetProperty("name").GetString().ShouldBe(LegacyHolder.DisplayName);
        by.GetProperty("formerStaff").GetBoolean().ShouldBeFalse();
        entry.GetProperty("doneTo").GetProperty("name").GetString().ShouldBe(LegacyHolder.DisplayName);
    }

    private static JsonContent? BodyFor(MatrixRow route) => route switch
    {
        { Method: "PUT" } => JsonContent.Create(new
        {
            firstName = "Taken",
            lastName = "Over",
            role = Roles.Manager,
            version = LegacyHolder.EditVersion,
            email = $"holder.{Guid.NewGuid():N}@example.com",
        }),
        { Method: "POST", RoutePattern: var pattern } when pattern.EndsWith("/temporary-password", StringComparison.Ordinal) =>
            JsonContent.Create(new { temporaryPassword = $"Tmp-{Guid.NewGuid():N}!x" }),
        _ => null,
    };

    private static async Task HolderExistsAsync(CspsDatabase target)
    {
        await using var context = target.CreateContext();
        var holder = await context.Users.AsNoTracking().SingleAsync(user => user.Id == LegacyHolder.Id, TestContext.Current.CancellationToken);
        holder.IsActive.ShouldBeFalse();
    }

    // Everything a user action could change on the holder, read straight from the database.
    private static async Task<HolderSnapshot> SnapshotAsync(CspsDatabase target)
    {
        await using var context = target.CreateContext();
        var row = await context.Users.AsNoTracking().Where(user => user.Id == LegacyHolder.Id).Select(user => new
        {
            user.IsActive,
            user.PasswordHash,
            user.Email,
            user.NormalizedEmail,
            user.UserName,
            user.EmailConfirmed,
            user.EditVersion,
            user.SecurityStamp,
            user.ConcurrencyStamp,
            user.FirstName,
            user.LastName,
            user.ManagerLockedAtUtc,
            user.DeletedAtUtc,
            user.PendingEmail,
            user.MustChangePassword,
            user.LockoutEnd,
            user.AccessFailedCount,
        }).SingleAsync(TestContext.Current.CancellationToken);
        var roles = await context.UserRoles.AsNoTracking().CountAsync(link => link.UserId == LegacyHolder.Id, TestContext.Current.CancellationToken);
        var tokens = await context.AccountTokens.AsNoTracking().CountAsync(token => token.UserId == LegacyHolder.Id, TestContext.Current.CancellationToken);
        return new HolderSnapshot(row.ToString() ?? string.Empty, roles, tokens);
    }

    private sealed record HolderSnapshot(string Columns, int RoleLinks, int AccountTokens);
}
