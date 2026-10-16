using System.Net;
using System.Text.Json;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Domain.Auditing;
using Csps.Domain.Identity;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Server.IntegrationTests.Auth;

/// <summary>
/// AUTH-11, D-14, D-18: a password accepted while the breach service was down is checked again at the next correct
/// password. A breach moves the account into the must-change step, a clean answer clears the mark, and an outage keeps it.
/// </summary>
public sealed class BreachRecheckTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string BreachedPassword = "Pwned#Pass2026";
    private const string CleanPassword = "Tela-Sukat-7381";
    private const string DownPassword = "Hibp-Down#2026";
    private const string ReplacementPassword = "Mabuhay#Tahi2026";

    [Fact]
    public async Task APasswordNowFoundInABreachSendsTheAccountToTheMustChangeStepAfterTheCode()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, BreachedPassword, recheckPending: true);

        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);

        verify.StatusCode.ShouldBe(HttpStatusCode.OK);
        using (var body = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)))
        {
            body.RootElement.GetProperty("next").GetString().ShouldBe("set-new-password");
            body.RootElement.GetProperty("reason").GetString().ShouldBe("breach");
        }

        verify.Headers.Contains("Set-Cookie").ShouldBeFalse();
        var account = await FindAsync(factory, staff.Id);
        account.MustChangePassword.ShouldBe(PasswordChangeReason.Breach);
        account.BreachRecheckPending.ShouldBeFalse();
        await using (var context = database.CreateContext())
        {
            var found = await context.AuditLog.AsNoTracking()
                .Where(a => a.Action == AuditActions.PasswordBreachFound && a.TargetId == staff.Id.ToString("D"))
                .ToListAsync(TestContext.Current.CancellationToken);
            found.ShouldHaveSingleItem().TargetType.ShouldBe("User");
        }

        using var saved = await AuthClient.SetNewPasswordAsync(client, ReplacementPassword);

        saved.StatusCode.ShouldBe(HttpStatusCode.OK);
        (await FindAsync(factory, staff.Id)).MustChangePassword.ShouldBeNull();
    }

    [Fact]
    public async Task APendingPasswordThatIsStillCleanIsClearedAndSignInIsNormal()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, CleanPassword, recheckPending: true);

        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);

        using var body = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("next").GetString().ShouldBe("signed-in");
        var account = await FindAsync(factory, staff.Id);
        account.BreachRecheckPending.ShouldBeFalse();
        account.MustChangePassword.ShouldBeNull();
        await using var context = database.CreateContext();
        (await context.AuditLog.AsNoTracking().AnyAsync(
            a => a.Action == AuditActions.PasswordBreachFound && a.TargetId == staff.Id.ToString("D"), TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task WhenTheBreachServiceIsStillDownTheRecheckStaysPendingAndSignInCompletes()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, DownPassword, recheckPending: true);

        using var verify = await AuthClient.SignInThroughCodeAsync(client, staff);

        using var body = JsonDocument.Parse(await verify.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        body.RootElement.GetProperty("next").GetString().ShouldBe("signed-in");
        var account = await FindAsync(factory, staff.Id);
        account.BreachRecheckPending.ShouldBeTrue();
        account.MustChangePassword.ShouldBeNull();
    }

    [Fact]
    public async Task AWrongPasswordNeverTriggersTheRecheck()
    {
        await using var factory = CspsApiFactory.ForDatabase(database.ConnectionString);
        using var client = AuthClient.CreateClient(factory);
        var staff = await AuthClient.CreateStaffWithPasswordAsync(factory, BreachedPassword, recheckPending: true);

        using var signIn = await AuthClient.SignInAsync(client, staff.Email, "not-the-password-1!");

        signIn.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
        var account = await FindAsync(factory, staff.Id);
        account.BreachRecheckPending.ShouldBeTrue();
        account.MustChangePassword.ShouldBeNull();
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
}
