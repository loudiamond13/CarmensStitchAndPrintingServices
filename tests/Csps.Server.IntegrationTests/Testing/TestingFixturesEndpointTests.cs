using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Server.IntegrationTests.Http;
using Csps.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Csps.Server.IntegrationTests.Testing;

/// <summary>
/// D-37, Pitfall 8: <c>POST /api/testing/staff</c> gives every E2E test its own staff account, in the Testing
/// environment of a Debug build only.
/// </summary>
public sealed class TestingFixturesEndpointTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Route = "/api/testing/staff";

    [Fact]
    public async Task ManagerIsCreatedActiveWithAPasswordThatMeetsTheRule()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { role = "Manager" }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await ReadCreatedAsync(response);
        created.Email.ShouldEndWith("@csps.test");
        PasswordPolicy.CheckComposition(created.Password).ShouldBeNull();

        var account = await FindAsync(factory, created.UserId);
        account.Email.ShouldBe(created.Email);
        account.Role.ShouldBe(Roles.Manager);
        account.IsActive.ShouldBeTrue();
        account.EmailConfirmed.ShouldBeTrue();
        account.HasPassword.ShouldBeTrue();
    }

    [Fact]
    public async Task EveryCallMakesANewAccountWithItsOwnPassword()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var first = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { role = "Admin" }, TestContext.Current.CancellationToken);
        using var second = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { role = "Admin" }, TestContext.Current.CancellationToken);

        var one = await ReadCreatedAsync(first);
        var two = await ReadCreatedAsync(second);
        one.Email.ShouldNotBe(two.Email);
        one.Password.ShouldNotBe(two.Password);
        one.UserId.ShouldNotBe(two.UserId);
    }

    [Fact]
    public async Task DeactivatedAdminIsCreatedInactive()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(
            new Uri(Route, UriKind.Relative), new { role = "Admin", state = "deactivated" }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var account = await FindAsync(factory, (await ReadCreatedAsync(response)).UserId);
        account.Role.ShouldBe(Roles.Admin);
        account.IsActive.ShouldBeFalse();
    }

    [Theory]
    [InlineData("must-change-temporary", PasswordChangeReason.Temporary)]
    [InlineData("must-change-breach", PasswordChangeReason.Breach)]
    public async Task MustChangeStatesCreateAnActiveAccountWithTheFlagAndReasonSet(string state, PasswordChangeReason reason)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { role = "Manager", state }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var created = await ReadCreatedAsync(response);
        PasswordPolicy.CheckComposition(created.Password).ShouldBeNull();
        var account = await FindAsync(factory, created.UserId);
        account.IsActive.ShouldBeTrue();
        account.EmailConfirmed.ShouldBeTrue();
        account.HasPassword.ShouldBeTrue();
        account.MustChangePassword.ShouldBe(reason);
    }

    [Fact]
    public async Task InvitedStateCreatesAnActiveAccountWithNoPasswordAndReturnsTheRawInviteToken()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(
            new Uri(Route, UriKind.Relative), new { role = "Manager", state = "invited" }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        var root = document.RootElement;
        root.TryGetProperty("password", out _).ShouldBeFalse();
        root.GetProperty("inviteToken").GetString().ShouldNotBeNull().Length.ShouldBe(43);
        var account = await FindAsync(factory, root.GetProperty("userId").GetGuid());
        account.Email.ShouldBe(root.GetProperty("email").GetString());
        account.IsActive.ShouldBeTrue();
        account.HasPassword.ShouldBeFalse();
    }

    [Theory]
    [InlineData("{\"role\":\"Owner\"}")]
    [InlineData("{\"role\":\"Admin\",\"state\":\"locked\"}")]
    [InlineData("{}")]
    [InlineData("not json")]
    public async Task UnknownRoleOrStateIsRejected(string body)
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = factory.CreateClient();
        using var content = new StringContent(body, Encoding.UTF8, "application/json");

        using var response = await client.PostAsync(new Uri(Route, UriKind.Relative), content, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var problem = await ProblemJson.ReadAsync(response, TestContext.Current.CancellationToken);
        problem.GetProperty("status").GetInt32().ShouldBe(400);
    }

    [Fact]
    public async Task DevelopmentDoesNotMapTheRoute()
    {
        await using var baseFactory = CspsApiFactory.ForDatabase(database.ConnectionString);
        await using var factory = baseFactory.WithWebHostBuilder(builder => builder.UseEnvironment(Environments.Development));
        using var client = factory.CreateClient();

        using var response = await client.PostAsJsonAsync(new Uri(Route, UriKind.Relative), new { role = "Manager" }, TestContext.Current.CancellationToken);

        response.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    private static async Task<Created> ReadCreatedAsync(HttpResponseMessage response)
    {
        var json = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(json);
        var root = document.RootElement;
        return new Created(
            root.GetProperty("userId").GetGuid(),
            root.GetProperty("email").GetString().ShouldNotBeNull(),
            root.GetProperty("password").GetString().ShouldNotBeNull());
    }

    private static async Task<UserAccount> FindAsync(CspsApiFactory factory, Guid id)
    {
        var scope = factory.Services.CreateAsyncScope();
        await using (scope)
        {
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            return (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        }
    }

    private sealed record Created(Guid UserId, string Email, string Password);
}
