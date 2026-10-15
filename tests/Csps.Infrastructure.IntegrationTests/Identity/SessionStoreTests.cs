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
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// AUTH-05, AUTH-06, D-43: sessions and refresh tokens through the real store over LocalDB (only hashes reach the
/// database, a token hash is unique), and the session cache answers from the database with eviction.
/// </summary>
public sealed class SessionStoreTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 14, 12, 0, 0, TimeSpan.Zero);
    private static readonly SessionSettings Settings = SessionSettings.Default;

    [Fact]
    public async Task ASessionAndItsTokenSurviveTheDatabaseAndStoreOnlyTheHash()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var hash = TokenHash.Compute("raw-refresh-token-one");
        var (session, token) = UserSession.Start(userId, persistent: true, "Chrome on Android", hash, Now, Settings);

        await using (var scope = provider.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<ISessions>().Add(session, token);
            await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        await using (var scope = provider.CreateAsyncScope())
        {
            var loaded = (await scope.ServiceProvider.GetRequiredService<ISessions>().FindAsync(session.Id, TestContext.Current.CancellationToken)).ShouldNotBeNull();
            loaded.UserId.ShouldBe(userId);
            loaded.Persistent.ShouldBeTrue();
            loaded.DeviceLabel.ShouldBe("Chrome on Android");
            loaded.AbsoluteExpiresAt.ShouldBe(Now.AddDays(90));
            loaded.RevokedAt.ShouldBeNull();
            loaded.RowVersion.Length.ShouldBe(8);
        }

        (await ReadStoredTokenHashAsync(token.Id)).ShouldBe(hash);
    }

    [Fact]
    public async Task ARefreshTokenHashCannotBeStoredTwice()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var hash = TokenHash.Compute("raw-refresh-token-shared");
        await StartAsync(provider, userId, hash);

        await Should.ThrowAsync<DbUpdateException>(() => StartAsync(provider, userId, hash));
    }

    [Fact]
    public async Task AnUnknownSessionIsNotFound()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        await using var scope = provider.CreateAsyncScope();

        (await scope.ServiceProvider.GetRequiredService<ISessions>().FindAsync(Guid.NewGuid(), TestContext.Current.CancellationToken)).ShouldBeNull();
    }

    [Fact]
    public async Task TheCacheAnswersFromTheDatabaseAndRefusesAnotherUsersToken()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var session = await StartAsync(provider, userId, TokenHash.Compute("raw-cache-1"));
        var cache = provider.GetRequiredService<ISessionCache>();

        (await cache.IsActiveAsync(session.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await cache.IsActiveAsync(session.Id, Guid.NewGuid(), TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await cache.IsActiveAsync(session.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await cache.IsActiveAsync(Guid.NewGuid(), userId, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task TheCacheRefusesASessionAtItsFixedEnd()
    {
        var time = new FakeTimeProvider(Now);
        await using var provider = BuildProvider(time);
        var userId = await CreateUserAsync(provider);
        var session = await StartAsync(provider, userId, TokenHash.Compute("raw-cache-2"));
        var cache = provider.GetRequiredService<ISessionCache>();

        (await cache.IsActiveAsync(session.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        time.SetUtcNow(session.AbsoluteExpiresAt.AddTicks(-1));
        (await cache.IsActiveAsync(session.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        time.SetUtcNow(session.AbsoluteExpiresAt);
        (await cache.IsActiveAsync(session.Id, userId, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    [Fact]
    public async Task EvictingBySessionOrByUserShowsARevocationAtOnce()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var first = await StartAsync(provider, userId, TokenHash.Compute("raw-cache-3"));
        var second = await StartAsync(provider, userId, TokenHash.Compute("raw-cache-4"));
        var cache = provider.GetRequiredService<ISessionCache>();
        (await cache.IsActiveAsync(first.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await cache.IsActiveAsync(second.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();

        await RevokeAsync(provider, first.Id);
        await RevokeAsync(provider, second.Id);
        (await cache.IsActiveAsync(first.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();

        await cache.EvictAsync(first.Id, TestContext.Current.CancellationToken);
        (await cache.IsActiveAsync(first.Id, userId, TestContext.Current.CancellationToken)).ShouldBeFalse();

        await cache.EvictUserAsync(userId, TestContext.Current.CancellationToken);
        (await cache.IsActiveAsync(second.Id, userId, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    private static async Task<UserSession> StartAsync(ServiceProvider provider, Guid userId, byte[] hash)
    {
        var (session, token) = UserSession.Start(userId, persistent: false, "Firefox on Windows", hash, Now, Settings);
        await using var scope = provider.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<ISessions>().Add(session, token);
        await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        return session;
    }

    private static async Task RevokeAsync(ServiceProvider provider, Guid sessionId)
    {
        await using var scope = provider.CreateAsyncScope();
        var session = (await scope.ServiceProvider.GetRequiredService<ISessions>().FindAsync(sessionId, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        session.Revoke(SessionRevocationReason.SignedOut, Now);
        await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private ServiceProvider BuildProvider(TimeProvider time)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { [TestSecrets.CodeMacKeySetting] = TestSecrets.CodeMacKeyBase64 })
            .Build();
        var services = new ServiceCollection();
        services.AddLogging();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddSingleton(time);
        services.AddHybridCache();
        services.AddCspsPersistence(database.ConnectionString);
        services.AddCspsIdentity();
        services.AddScoped<IUnitOfWork, CspsUnitOfWork>();
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

    // Reads the raw column with plain SQL, independent of the EF model.
    private async Task<byte[]> ReadStoredTokenHashAsync(Guid tokenId)
    {
        await using var connection = new SqlConnection(database.ConnectionString);
        await connection.OpenAsync(TestContext.Current.CancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT TokenHash FROM dbo.RefreshTokens WHERE Id = @id;";
        command.Parameters.AddWithValue("@id", tokenId);
        return (byte[])(await command.ExecuteScalarAsync(TestContext.Current.CancellationToken)).ShouldNotBeNull();
    }
}
