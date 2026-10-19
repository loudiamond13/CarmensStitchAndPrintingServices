using System.Globalization;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
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
    public async Task APasswordAccountKeptUnconfirmedHoldsTheHashButNotTheConfirmation()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();

        var id = await accounts.CreateAsync(
            new NewUserAccount(NewEmail(), "Tess", "Tan", Roles.Manager, Password, KeepEmailUnconfirmed: true), TestContext.Current.CancellationToken);

        var found = (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        found.HasPassword.ShouldBeTrue();
        found.EmailConfirmed.ShouldBeFalse();
        (await accounts.CheckPasswordAsync(id, Password, TestContext.Current.CancellationToken)).ShouldBe(PasswordCheck.Succeeded);
    }

    [Theory]
    [InlineData("o'brien.{0}@example.com")]
    [InlineData("rey!#$%&*=?^{0}@example.com")]
    [InlineData("josé.{0}@example.com")]
    public async Task AnEmailWithCharactersIdentityDoesNotListByDefaultStillCreatesAnAccount(string pattern)
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var email = string.Format(CultureInfo.InvariantCulture, pattern, Guid.NewGuid().ToString("N"));

        var id = await accounts.CreateAsync(new NewUserAccount(email, "Sean", "O'Brien", Roles.Manager, Password), TestContext.Current.CancellationToken);

        (await accounts.FindByEmailAsync(email, TestContext.Current.CancellationToken))!.Id.ShouldBe(id);
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

        (await IsLockedAsync(accounts, id)).ShouldBeFalse();

        var fifth = await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);

        fifth.LockedNow.ShouldBeTrue();
        fifth.LockoutEnd.ShouldNotBeNull();
        fifth.LockoutEnd.Value.ShouldBe(TimeProvider.System.GetUtcNow() + LockoutLength, TimeSpan.FromMinutes(1));
        (await IsLockedAsync(accounts, id)).ShouldBeTrue();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd.ShouldBe(fifth.LockoutEnd);

        // A sixth failure on a locked account is not a new lockout, so the lockout email goes out once.
        (await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken)).LockedNow.ShouldBeFalse();
    }

    [Fact]
    public async Task ParallelWrongGuessesAreAllCountedAndLockTheAccountOnce()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        Guid id;
        await using (var setup = provider.CreateAsyncScope())
        {
            id = await setup.ServiceProvider.GetRequiredService<IUserAccounts>()
                .CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        }

        const int Guesses = 8;
        var results = await Task.WhenAll(Enumerable.Range(0, Guesses).Select(async _ =>
        {
            await using var scope = provider.CreateAsyncScope();
            return await scope.ServiceProvider.GetRequiredService<IUserAccounts>().RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken);
        }));

        // Every guess counts: 5 lock the account (and restart the count), the other 3 are counted after it.
        results.Count(static result => result.LockedNow).ShouldBe(1);
        await using var check = provider.CreateAsyncScope();
        var user = await check.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>()
            .FindByIdAsync(id.ToString("D", CultureInfo.InvariantCulture));
        user.ShouldNotBeNull();
        user.LockoutEnd.ShouldNotBeNull();
        user.AccessFailedCount.ShouldBe(Guesses - 5);
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

        (await IsLockedAsync(accounts, id)).ShouldBeFalse();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd.ShouldBeNull();

        // The count restarted: four more failures do not lock again.
        for (var attempt = 0; attempt < 4; attempt++)
        {
            (await accounts.RecordFailedPasswordAsync(id, TestContext.Current.CancellationToken)).LockedNow.ShouldBeFalse();
        }
    }

    [Fact]
    public async Task ClearingTheLockoutNeverLiftsAManagerLockADeactivationOrADelete()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        var user = (await users.FindByIdAsync(id.ToString("D", CultureInfo.InvariantCulture))).ShouldNotBeNull();
        user.IsActive = false;
        user.ManagerLockedAtUtc = DateTimeOffset.UnixEpoch.AddYears(56);
        user.DeletedAtUtc = DateTimeOffset.UnixEpoch.AddYears(56);
        (await users.UpdateAsync(user)).Succeeded.ShouldBeTrue();
        await accounts.LockUntilAsync(id, TimeProvider.System.GetUtcNow().Add(LockoutLength), TestContext.Current.CancellationToken);

        await accounts.ClearLockoutAsync(id, TestContext.Current.CancellationToken);

        var after = (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        after.LockoutEnd.ShouldBeNull();
        after.IsActive.ShouldBeFalse();
        after.IsManagerLocked.ShouldBeTrue();
        after.IsDeleted.ShouldBeTrue();
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

        (await IsLockedAsync(accounts, id)).ShouldBeTrue();
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
    public async Task ManagerLockedManagerDoesNotCount()
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
            manager.ManagerLockedAtUtc = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
            (await users.UpdateAsync(manager)).Succeeded.ShouldBeTrue();

            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeFalse();
            (await accounts.CountActiveManagersAsync(null, TestContext.Current.CancellationToken)).ShouldBe(0);
        }
    }

    [Fact]
    public async Task DeletedManagerDoesNotCount()
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
            manager.DeletedAtUtc = new DateTimeOffset(2026, 10, 1, 12, 0, 0, TimeSpan.Zero);
            (await users.UpdateAsync(manager)).Succeeded.ShouldBeTrue();

            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeFalse();
            (await accounts.CountActiveManagersAsync(null, TestContext.Current.CancellationToken)).ShouldBe(0);
        }
    }

    [Fact]
    public async Task AFailedPasswordLockoutStillCounts()
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
            manager.LockoutEnd = new DateTimeOffset(2099, 1, 1, 0, 0, 0, TimeSpan.Zero);
            (await users.UpdateAsync(manager)).Succeeded.ShouldBeTrue();

            (await accounts.AnyActiveManagerAsync(TestContext.Current.CancellationToken)).ShouldBeTrue();
            (await accounts.CountActiveManagersAsync(null, TestContext.Current.CancellationToken)).ShouldBe(1);
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

        await Should.ThrowAsync<EmailInUseException>(() => accounts.CreateAsync(
            new NewUserAccount(email.ToUpperInvariant(), "C", "D", Roles.Admin, Password), TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task TheUniqueEmailIndexAloneRefusesADuplicateAndLeavesNoRowTracked()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
        var email = NewEmail();
        await accounts.CreateAsync(new NewUserAccount(email, "A", "B", Roles.Admin, Password), TestContext.Current.CancellationToken);

        // With Identity's own lookup out of the way, as when it ran before the other create committed, only the index is left to refuse.
        users.UserValidators.Clear();
        await Should.ThrowAsync<EmailInUseException>(() => accounts.CreateAsync(
            new NewUserAccount(email.ToUpperInvariant(), "C", "D", Roles.Admin, Password), TestContext.Current.CancellationToken));

        context.ChangeTracker.Entries<ApplicationUser>().Any(entry => entry.State == EntityState.Added).ShouldBeFalse();
        (await context.SaveChangesAsync(TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TheManagerLockSetsAndClearsOnlyOnARealChangeAndLeavesTheFailedPasswordLockoutAlone()
    {
        await using var provider = BuildProvider(database.ConnectionString);
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        var id = await accounts.CreateAsync(NewAccount(Roles.Admin, Password), TestContext.Current.CancellationToken);
        await LockByFailuresAsync(accounts, id);
        var lockedAt = new DateTimeOffset(2026, 10, 18, 9, 0, 0, TimeSpan.Zero);

        (await accounts.SetManagerLockAsync(id, null, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await accounts.SetManagerLockAsync(id, lockedAt, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await accounts.SetManagerLockAsync(id, lockedAt.AddDays(1), TestContext.Current.CancellationToken)).ShouldBeFalse();

        var locked = (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!;
        locked.IsManagerLocked.ShouldBeTrue();
        locked.IsBlocked.ShouldBeTrue();
        await using (var context = database.CreateContext())
        {
            (await context.Users.AsNoTracking().SingleAsync(user => user.Id == id, TestContext.Current.CancellationToken)).ManagerLockedAtUtc.ShouldBe(lockedAt);
        }

        (await accounts.SetManagerLockAsync(id, null, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.IsManagerLocked.ShouldBeFalse();
        (await IsLockedAsync(accounts, id)).ShouldBeTrue();
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

        (await IsLockedAsync(accounts, id)).ShouldBeTrue();
    }

    private static ServiceProvider BuildProvider(string connectionString)
    {
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddCspsPersistence(connectionString);
        services.AddCspsIdentity();
        return services.BuildServiceProvider(validateScopes: true);
    }

    // A failed-password lockout is on while its end lies in the future.
    private static async Task<bool> IsLockedAsync(IUserAccounts accounts, Guid id) =>
        (await accounts.FindByIdAsync(id, TestContext.Current.CancellationToken))!.LockoutEnd is { } end && end > TimeProvider.System.GetUtcNow();
}
