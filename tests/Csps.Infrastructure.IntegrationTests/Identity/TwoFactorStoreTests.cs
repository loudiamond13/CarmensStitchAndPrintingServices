using System.Text;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// AUTH-02, AUTH-03: sign-in challenges and their codes through the real store over LocalDB. Only hashes and MACs
/// reach the database, and a code verifies once after a reload.
/// </summary>
public sealed class TwoFactorStoreTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);
    private static readonly TwoFactorSettings Settings = TwoFactorSettings.Default;

    // Fixed so a test can issue a right and a wrong code without chance.
    private const string KnownCode = "123456";
    private const string WrongCode = "654321";

    private enum Finish
    {
        None,
        AwaitNewPassword,
        Complete,
    }

    [Fact]
    public async Task ChallengeAndHmacBoundCodeSurviveTheDatabaseAndVerifyExactlyOnce()
    {
        await using var provider = BuildProvider();
        var userId = await CreateUserAsync(provider);
        var random = provider.GetRequiredService<ISecureRandom>();
        var codeMac = provider.GetRequiredService<ICodeMac>();
        var ticket = random.NewToken();
        var code = random.NewSixDigitCode();
        Guid challengeId;

        await using (var scope = provider.CreateAsyncScope())
        {
            var challenge = TwoFactorChallenge.Start(userId, TokenHash.Compute(ticket), persistent: false, Now, Settings);
            challenge.IssueCode(codeMac.Compute(challenge.Id, userId, code), Now, Settings);
            challengeId = challenge.Id;
            scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>().Add(challenge);
            await scope.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var scope = provider.CreateAsyncScope())
        {
            var found = await scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
                .FindByTicketHashAsync(TokenHash.Compute(ticket), TestContext.Current.CancellationToken);

            found.ShouldNotBeNull();
            found.Id.ShouldBe(challengeId);
            found.UserId.ShouldBe(userId);
            found.Codes.Count.ShouldBe(1);
            found.Verify(codeMac.Compute(challengeId, userId, code), Now.AddMinutes(1), Settings).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
            await scope.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var scope = provider.CreateAsyncScope())
        {
            var reloaded = await scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
                .FindByTicketHashAsync(TokenHash.Compute(ticket), TestContext.Current.CancellationToken);

            reloaded.ShouldNotBeNull();
            reloaded.Codes.Single().ConsumedAt.ShouldNotBeNull();
            reloaded.Verify(codeMac.Compute(challengeId, userId, code), Now.AddMinutes(2), Settings).Outcome
                .ShouldBe(TwoFactorVerifyOutcome.ChallengeClosed);

            (await scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
                .FindByTicketHashAsync(TokenHash.Compute(random.NewToken()), TestContext.Current.CancellationToken)).ShouldBeNull();
        }

        var stored = await ReadStoredBytesAsync(challengeId);
        stored.TicketHash.ShouldBe(TokenHash.Compute(ticket));
        stored.TicketHash.Length.ShouldBe(TokenHash.HashLength);
        stored.CodeMac.ShouldBe(codeMac.Compute(challengeId, userId, code));
        stored.CodeMac.Length.ShouldBe(TokenHash.HashLength);
        stored.TicketHash.ShouldNotBe(Encoding.UTF8.GetBytes(ticket));
        stored.CodeMac.ShouldNotBe(Encoding.ASCII.GetBytes(code));
    }

    [Fact]
    public async Task CountsCodesIssuedAcrossChallengesInsideTheWindowForOneAccountOnly()
    {
        await using var provider = BuildProvider();
        var user = await CreateUserAsync(provider);
        var other = await CreateUserAsync(provider);
        var since = Now.AddHours(-1);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-50), codes: 2);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-30), codes: 3);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-10), codes: 1);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-62), codes: 2);
        await AddChallengeAsync(provider, other, Now.AddMinutes(-5), codes: 2);

        await using var scope = provider.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>();

        (await store.CountCodesIssuedSinceAsync(user, since, TestContext.Current.CancellationToken)).ShouldBe(6);
        (await store.CountCodesIssuedSinceAsync(other, since, TestContext.Current.CancellationToken)).ShouldBe(2);
        (await store.CountCodesIssuedSinceAsync(Guid.NewGuid(), since, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task SumsWrongCodesAcrossChallengesInsideTheWindowForOneAccountOnly()
    {
        await using var provider = BuildProvider();
        var user = await CreateUserAsync(provider);
        var other = await CreateUserAsync(provider);
        var since = Now.AddHours(-1);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-40), codes: 1, wrongTries: 2);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-20), codes: 2, wrongTries: 3);
        await AddChallengeAsync(provider, user, Now.AddMinutes(-62), codes: 1, wrongTries: 4);
        await AddChallengeAsync(provider, other, Now.AddMinutes(-5), codes: 1, wrongTries: 1);

        await using var scope = provider.CreateAsyncScope();
        var store = scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>();

        (await store.CountFailedAttemptsSinceAsync(user, since, TestContext.Current.CancellationToken)).ShouldBe(5);
        (await store.CountFailedAttemptsSinceAsync(other, since, TestContext.Current.CancellationToken)).ShouldBe(1);
    }

    [Fact]
    public async Task InvalidatingOpenChallengesLeavesFinishedAndForeignOnesAlone()
    {
        await using var provider = BuildProvider();
        var user = await CreateUserAsync(provider);
        var other = await CreateUserAsync(provider);
        var pending = await AddChallengeAsync(provider, user, Now.AddMinutes(-5), codes: 1);
        var awaiting = await AddChallengeAsync(provider, user, Now.AddMinutes(-4), codes: 1, finish: Finish.AwaitNewPassword);
        var completed = await AddChallengeAsync(provider, user, Now.AddMinutes(-3), codes: 1, finish: Finish.Complete);
        var foreign = await AddChallengeAsync(provider, other, Now.AddMinutes(-2), codes: 1);

        await using (var scope = provider.CreateAsyncScope())
        {
            var store = scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>();
            (await store.InvalidateOpenAsync(user, Now, TestContext.Current.CancellationToken)).ShouldBe(2);
            await scope.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        (await StatusOfAsync(provider, pending)).ShouldBe(TwoFactorChallengeStatus.Invalidated);
        (await StatusOfAsync(provider, awaiting)).ShouldBe(TwoFactorChallengeStatus.Invalidated);
        (await StatusOfAsync(provider, completed)).ShouldBe(TwoFactorChallengeStatus.Completed);
        (await StatusOfAsync(provider, foreign)).ShouldBe(TwoFactorChallengeStatus.Pending);

        await using var again = provider.CreateAsyncScope();
        (await again.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
            .InvalidateOpenAsync(user, Now, TestContext.Current.CancellationToken)).ShouldBe(0);
    }

    [Fact]
    public async Task TwoVerificationsOfTheSameCodeCannotBothWin()
    {
        await using var provider = BuildProvider();
        var user = await CreateUserAsync(provider);
        var challenge = await AddChallengeAsync(provider, user, Now, codes: 1);
        var codeMac = provider.GetRequiredService<ICodeMac>();
        var mac = codeMac.Compute(challenge.Id, user, KnownCode);

        await using var first = provider.CreateAsyncScope();
        await using var second = provider.CreateAsyncScope();
        var one = await first.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
            .FindByTicketHashAsync(TokenHash.Compute(challenge.Ticket), TestContext.Current.CancellationToken);
        var two = await second.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
            .FindByTicketHashAsync(TokenHash.Compute(challenge.Ticket), TestContext.Current.CancellationToken);

        one!.Verify(mac, Now.AddMinutes(1), Settings).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
        two!.Verify(mac, Now.AddMinutes(1), Settings).Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);

        await first.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken);
        await Should.ThrowAsync<DbUpdateConcurrencyException>(() =>
            second.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken));
    }

    // Saves a challenge started at startedAt with its codes one minute apart; the newest code gets the wrong tries.
    private static async Task<(Guid Id, string Ticket)> AddChallengeAsync(
        ServiceProvider provider, Guid userId, DateTimeOffset startedAt, int codes, int wrongTries = 0, Finish finish = Finish.None)
    {
        var ticket = provider.GetRequiredService<ISecureRandom>().NewToken();
        var codeMac = provider.GetRequiredService<ICodeMac>();
        var challenge = TwoFactorChallenge.Start(userId, TokenHash.Compute(ticket), persistent: false, startedAt, Settings);
        var issuedAt = startedAt;
        for (var index = 0; index < codes; index++)
        {
            issuedAt = startedAt.AddMinutes(index);
            challenge.IssueCode(codeMac.Compute(challenge.Id, userId, KnownCode), issuedAt, Settings);
        }

        for (var attempt = 0; attempt < wrongTries; attempt++)
        {
            challenge.Verify(codeMac.Compute(challenge.Id, userId, WrongCode), issuedAt.AddSeconds(1), Settings);
        }

        if (finish != Finish.None)
        {
            challenge.Verify(codeMac.Compute(challenge.Id, userId, KnownCode), issuedAt.AddSeconds(2), Settings)
                .Outcome.ShouldBe(TwoFactorVerifyOutcome.Ok);
            if (finish == Finish.AwaitNewPassword)
            {
                challenge.RequirePasswordChange(PasswordChangeReason.Temporary);
            }
            else
            {
                challenge.Complete(issuedAt.AddSeconds(3));
            }
        }

        await using var scope = provider.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>().Add(challenge);
        await scope.ServiceProvider.GetRequiredService<CspsDbContext>().SaveChangesAsync(TestContext.Current.CancellationToken);
        return (challenge.Id, ticket);
    }

    private static async Task<TwoFactorChallengeStatus> StatusOfAsync(ServiceProvider provider, (Guid Id, string Ticket) challenge)
    {
        await using var scope = provider.CreateAsyncScope();
        var found = await scope.ServiceProvider.GetRequiredService<ITwoFactorChallenges>()
            .FindByTicketHashAsync(TokenHash.Compute(challenge.Ticket), TestContext.Current.CancellationToken);
        return found!.Status;
    }

    private ServiceProvider BuildProvider()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [TestSecrets.CodeMacKeySetting] = TestSecrets.CodeMacKeyBase64 })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsIdentity();
        return services.BuildServiceProvider(validateScopes: true);
    }

    private static async Task<Guid> CreateUserAsync(ServiceProvider provider)
    {
        await using var scope = provider.CreateAsyncScope();
        var accounts = scope.ServiceProvider.GetRequiredService<IUserAccounts>();
        return await accounts.CreateAsync(
            new NewUserAccount($"staff.{Guid.NewGuid():N}@example.com", "Test", "Person", Roles.Admin, "Tela-Sukat-7381"),
            TestContext.Current.CancellationToken);
    }

    // Reads the raw columns with plain SQL, independent of the EF model.
    private async Task<(byte[] TicketHash, byte[] CodeMac)> ReadStoredBytesAsync(Guid challengeId)
    {
        await using var connection = new SqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            "SELECT c.TicketHash, k.CodeMac FROM dbo.TwoFactorChallenges c JOIN dbo.TwoFactorCodes k ON k.ChallengeId = c.Id WHERE c.Id = @id;";
        command.Parameters.AddWithValue("@id", challengeId);
        await using var reader = await command.ExecuteReaderAsync(TestContext.Current.CancellationToken);
        (await reader.ReadAsync(TestContext.Current.CancellationToken)).ShouldBeTrue();
        return ((byte[])reader.GetValue(0), (byte[])reader.GetValue(1));
    }
}
