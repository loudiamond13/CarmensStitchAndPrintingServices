using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// AUTH-01, AUTH-07, AUTH-10: the account port the auth handlers use, over real Identity and LocalDB. Each test
/// creates its own accounts with fresh emails.
/// </summary>
public sealed class UserAccountsTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string Password = "Tela-Sukat-7381";
    private static readonly TimeSpan LockoutLength = TimeSpan.FromMinutes(15);

    [Fact]
    public async Task CreatedAccountIsFoundByEmailInAnyCaseWithItsRole()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var email = NewEmail();

        var id = await accounts.CreateAsync(new NewUserAccount(email, "Maria", "Santos", Roles.Admin, Password), TestContext.Current.CancellationToken);
        var found = await accounts.FindByEmailAsync(email.ToUpperInvariant(), TestContext.Current.CancellationToken);

        found.ShouldNotBeNull();
        found.Id.ShouldBe(id);
        found.Email.ShouldBe(email);
        found.FirstName.ShouldBe("Maria");
        found.LastName.ShouldBe("Santos");
        found.Role.ShouldBe(Roles.Admin);
        found.IsActive.ShouldBeTrue();
        found.EmailConfirmed.ShouldBeTrue();
        found.HasPassword.ShouldBeTrue();
        found.MustChangePassword.ShouldBeNull();
        found.BreachRecheckPending.ShouldBeFalse();
        found.LockoutEnd.ShouldBeNull();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.Email.ShouldBe(email);
    }

    [Fact]
    public async Task UnknownAccountsAreNotFound()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();

        (await accounts.FindByEmailAsync(NewEmail(), TestContext.Current.CancellationToken)).ShouldBeNull();
        (await accounts.FindByIdAsync(Guid.NewGuid(), TestContext.Current.CancellationToken)).ShouldBeNull();
    }

    [Fact]
    public async Task PasswordIsCheckedOnTheNfcFormBothWays()
    {
        const string Composed = "Café-Sukat-7381";
        const string Decomposed = "Café-Sukat-7381";
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var composedId = await accounts.CreateAsync(NewAccount(Roles.Admin, Composed), TestContext.Current.CancellationToken);
        var decomposedId = await accounts.CreateAsync(NewAccount(Roles.Admin, Decomposed), TestContext.Current.CancellationToken);

        (await accounts.CheckPasswordAsync(composedId, Decomposed, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
        (await accounts.CheckPasswordAsync(decomposedId, Composed, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
        (await accounts.CheckPasswordAsync(composedId, "Cafe-Sukat-7381", TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
        (await accounts.CheckPasswordAsync(composedId, "wrong password 1", TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
    }

    [Fact]
    public async Task AccountWithoutAPasswordCannotPassACheck()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Manager, password: null), TestContext.Current.CancellationToken);

        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.HasPassword.ShouldBeFalse();
        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
        (await accounts.CheckPasswordAsync(id, string.Empty, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
    }

    [Fact]
    public async Task DummyVerificationRunsAndReturnsNothing()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();

        Should.NotThrow(() => accounts.VerifyDummyPassword("anything"));
        Should.NotThrow(() => accounts.VerifyDummyPassword(string.Empty));
    }

    [Fact]
    public async Task FifthFailedPasswordLocksTheAccountForFifteenMinutesAndReportsItOnce()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);

        for (var attempt = 1; attempt <= 4; attempt++)
        {
            var result = await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);
            result.LockedNow.ShouldBeFalse($"Failed attempt {attempt.ToString(CultureInfo.InvariantCulture)} must not lock.");
            result.LockoutEnd.ShouldBeNull();
        }

        (await accounts.IsLockedOutAsync(id, TestContext.Current.CancellationToken)).ShouldBeFalse();

        var fifth = await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);

        fifth.LockedNow.ShouldBeTrue();
        fifth.LockoutEnd.ShouldNotBeNull();
        fifth.LockoutEnd.Value.ShouldBe(TimeProvider.System.GetUtcNow() + LockoutLength, TimeSpan.FromMinutes(1));
        (await accounts.IsLockedOutAsync(id, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd.ShouldBe(fifth.LockoutEnd);

        // A sixth failure on a locked account is not a new lockout, so the lockout email goes out once.
        (await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken)).LockedNow.ShouldBeFalse();
    }

    [Fact]
    public async Task ClearingTheLockoutUnlocksAndResetsTheCount()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        await LockByFailuresAsync(accounts, id);

        await accounts.ClearLockoutAsync(id, TestContext.Current.CancellationToken);

        (await accounts.IsLockedOutAsync(id, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd.ShouldBeNull();

        // The count restarted: four more failures do not lock again.
        for (var attempt = 0; attempt < 4; attempt++)
        {
            (await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken)).LockedNow.ShouldBeFalse();
        }
    }

    [Fact]
    public async Task ResetFailedCountStartsTheCountAgain()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        for (var attempt = 0; attempt < 4; attempt++)
        {
            await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);
        }

        await accounts.ResetFailedCountAsync(id, TestContext.Current.CancellationToken);

        for (var attempt = 0; attempt < 4; attempt++)
        {
            (await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken)).LockedNow.ShouldBeFalse();
        }
    }

    [Fact]
    public async Task LockUntilLocksTheAccountUntilThatTime()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        var until = TimeProvider.System.GetUtcNow().AddMinutes(30);

        await accounts.LockUntilAsync(id, until, TestContext.Current.CancellationToken);

        (await accounts.IsLockedOutAsync(id, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd.ShouldBe(until);
    }

    [Fact]
    public async Task SettingAPasswordChangesTheHashAndTheSecurityStamp()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        var before = await users.FindByIdAsync(id.ToString());
        var hashBefore = before!.PasswordHash;
        var stampBefore = before.SecurityStamp;
        const string NewPassword = "Kapa-Lumang-9042";

        await accounts.SetPasswordAsync(id, NewPassword, TestContext.Current.CancellationToken);

        var after = await users.FindByIdAsync(id.ToString());
        after!.PasswordHash.ShouldNotBe(hashBefore);
        after.SecurityStamp.ShouldNotBe(stampBefore);
        (await accounts.CheckPasswordAsync(id, NewPassword, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
    }

    [Fact]
    public async Task SettingAPasswordGivesAnAccountWithoutOneAPassword()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Manager, password: null), TestContext.Current.CancellationToken);

        await accounts.SetPasswordAsync(id, Password, TestContext.Current.CancellationToken);

        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.HasPassword.ShouldBeTrue();
        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
    }

    [Fact]
    public async Task OldHashIsReHashedOnASuccessfulCheck()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        var user = (await users.FindByIdAsync(id.ToString()))!;

        // A hash made with fewer iterations than the current setting needs a re-hash.
        var weak = new PasswordHasher<ApplicationUser>(
            Microsoft.Extensions.Options.Options.Create(new PasswordHasherOptions { IterationCount = 10_000 }));
        user.PasswordHash = weak.HashPassword(user, Password);
        (await users.UpdateAsync(user)).Succeeded.ShouldBeTrue();
        var weakHash = user.PasswordHash;

        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);

        (await users.FindByIdAsync(id.ToString()))!.PasswordHash.ShouldNotBe(weakHash);
        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
    }

    [Fact]
    public async Task MustChangePasswordRoundTrips()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);

        await accounts.SetMustChangePasswordAsync(id, PasswordChangeReason.Temporary, TestContext.Current.CancellationToken);
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.MustChangePassword.ShouldBe(PasswordChangeReason.Temporary);

        await accounts.SetMustChangePasswordAsync(id, PasswordChangeReason.Breach, TestContext.Current.CancellationToken);
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.MustChangePassword.ShouldBe(PasswordChangeReason.Breach);

        await accounts.ClearMustChangePasswordAsync(id, TestContext.Current.CancellationToken);
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.MustChangePassword.ShouldBeNull();
    }

    [Fact]
    public async Task BreachRecheckRoundTrips()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);

        await accounts.MarkBreachRecheckAsync(id, TestContext.Current.CancellationToken);
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.BreachRecheckPending.ShouldBeTrue();

        await accounts.ClearBreachRecheckAsync(id, TestContext.Current.CancellationToken);
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.BreachRecheckPending.ShouldBeFalse();
    }

    [Fact]
    public async Task AnyActiveManagerIsFalseOnAnEmptyDatabaseAndTrueOnceOneExists()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            await using var provider = BuildProvider(own.ConnectionString);
            await using var scope = provider.CreateAsyncScope();
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();

            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeFalse();

            await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeFalse("An Admin is not a Manager.");

            await accounts.CreateAsync(NewAccount(Roles.Manager, Password), TestContext.Current.CancellationToken);
            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeTrue();
        }
    }

    [Fact]
    public async Task DeactivatedManagerDoesNotCount()
    {
        var own = await CspsDatabase.CreateAsync();
        await using (own)
        {
            await using var provider = BuildProvider(own.ConnectionString);
            await using var scope = provider.CreateAsyncScope();
            var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var id = await accounts.CreateAsync(NewAccount(Roles.Manager, Password), TestContext.Current.CancellationToken);
            var manager = (await users.FindByIdAsync(id.ToString()))!;
            manager.IsActive = false;
            (await users.UpdateAsync(manager)).Succeeded.ShouldBeTrue();

            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeFalse();
        }
    }

    [Fact]
    public async Task CreatingADuplicateEmailFails()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var email = NewEmail();
        await accounts.CreateAsync(new NewUserAccount(email, "A", "B", Roles.Admin, Password), TestContext.Current.CancellationToken);

        await Should.ThrowAsync<InvalidOperationException>(() => accounts.CreateAsync(
            new NewUserAccount(email.ToUpperInvariant(), "C", "D", Roles.Admin, Password), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task ChangingAnUnknownAccountFails()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();

        await Should.ThrowAsync<InvalidOperationException>(() => accounts.SetPasswordAsync(Guid.NewGuid(), Password, TestContext.Current.CancellationToken));
        await Should.ThrowAsync<InvalidOperationException>(() => accounts.ClearLockoutAsync(Guid.NewGuid(), TestContext.Current.CancellationToken));
        (await accounts.CheckPasswordAsync(Guid.NewGuid(), Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Failed);
    }

    private static string NewEmail() => $"staff.{Guid.NewGuid():N}@example.com";

    private static NewUserAccount NewAccount(string role, string? password) => new(NewEmail(), "Test", "Person", role, password);

    private static async Task LockByFailuresAsync(IUserAccounts accounts, Guid id)
    {
        for (var attempt = 0; attempt < 5; attempt++)
        {
            await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);
        }

        (await accounts.IsLockedOutAsync(id, TestContext.Current.CancellationToken)).ShouldBeTrue();
    }

    private static ServiceProvider BuildProvider(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddCspsPersistence(connectionString);
        services.AddCspsIdentity();
        return services.BuildServiceProvider(validateScopes: true);
    }
}
