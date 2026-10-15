using System.Text;
using Csps.Application.Auth;
using Csps.Application.Ports;
using Csps.Application.Security;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Testing;
using Microsoft.Data.SqlClient;
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
