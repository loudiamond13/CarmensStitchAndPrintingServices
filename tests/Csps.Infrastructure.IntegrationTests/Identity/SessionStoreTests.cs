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

    [Fact]
    public async Task AnUnknownRefreshHashFindsNothing()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        await using var scope = provider.CreateAsyncScope();

        var found = await scope.ServiceProvider.GetRequiredService<ISessions>()
            .FindByRefreshHashAsync(TokenHash.Compute("raw-never-issued"), TestContext.Current.CancellationToken);

        found.ShouldBeNull();
    }

    [Fact]
    public async Task ARefreshHashFindsItsSessionAndOnlyTheTokensRotationNeeds()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var hashA = TokenHash.Compute("raw-rotate-a");
        var hashB = TokenHash.Compute("raw-rotate-b");
        var hashC = TokenHash.Compute("raw-rotate-c");
        var session = await StartAsync(provider, userId, hashA);
        await RotateAsync(provider, hashA, hashB, Now);
        await RotateAsync(provider, hashB, hashC, Now.AddMinutes(1));

        // A is used with child B; B is used with child C; C is the only open token.
        var lookupA = await FindAsync(provider, hashA);
        lookupA.Session.Id.ShouldBe(session.Id);
        lookupA.Presented.TokenHash.ShouldBe(hashA);
        lookupA.Related.Select(token => token.TokenHash).ShouldBe([hashA, hashB, hashC], ignoreOrder: true);

        var lookupC = await FindAsync(provider, hashC);
        lookupC.Presented.TokenHash.ShouldBe(hashC);
        lookupC.Related.Select(token => token.TokenHash).ShouldBe([hashC]);
    }

    [Fact]
    public async Task AChildTokenAddedToTheStoreCanBeFoundByItsHash()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var hashA = TokenHash.Compute("raw-child-a");
        var hashB = TokenHash.Compute("raw-child-b");
        var session = await StartAsync(provider, userId, hashA);

        await RotateAsync(provider, hashA, hashB, Now);

        var child = await FindAsync(provider, hashB);
        child.Session.Id.ShouldBe(session.Id);
        child.Presented.ParentId.ShouldBe((await FindAsync(provider, hashA)).Presented.Id);
        child.Presented.ConsumedAt.ShouldBeNull();
        (await FindAsync(provider, hashA)).Presented.ConsumedAt.ShouldBe(Now);
    }

    [Fact]
    public async Task RevokingAllButOneEndsTheOthersAtOnceAndLeavesOtherUsersAlone()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var otherUserId = await CreateUserAsync(provider);
        var keep = await StartAsync(provider, userId, TokenHash.Compute("raw-all-keep"));
        var sameInstant = await StartAsync(provider, userId, TokenHash.Compute("raw-all-same"));
        var other = await StartAsync(provider, userId, TokenHash.Compute("raw-all-other"));
        var strangers = await StartAsync(provider, otherUserId, TokenHash.Compute("raw-all-stranger"));
        var cache = provider.GetRequiredService<ISessionCache>();
        foreach (var warmed in new[] { keep, sameInstant, other })
        {
            (await cache.IsActiveAsync(warmed.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        }

        var revoked = await RevokeAllAsync(provider, userId, keep.Id, Now.AddSeconds(5));

        revoked.ShouldBe([sameInstant.Id, other.Id], ignoreOrder: true);
        await cache.EvictUserAsync(userId, TestContext.Current.CancellationToken);
        (await cache.IsActiveAsync(keep.Id, userId, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await cache.IsActiveAsync(sameInstant.Id, userId, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await cache.IsActiveAsync(other.Id, userId, TestContext.Current.CancellationToken)).ShouldBeFalse();
        (await cache.IsActiveAsync(strangers.Id, otherUserId, TestContext.Current.CancellationToken)).ShouldBeTrue();

        var stored = await ReadSessionAsync(provider, other.Id);
        stored.RevokedAt.ShouldBe(Now.AddSeconds(5));
        stored.RevokedReason.ShouldBe(SessionRevocationReason.SignedOutOtherDevices);
        (await ReadSessionAsync(provider, keep.Id)).RevokedAt.ShouldBeNull();
        (await ReadSessionAsync(provider, strangers.Id)).RevokedAt.ShouldBeNull();
        (await ReadOpenTokenCountAsync(provider, other.Id)).ShouldBe(0);
        (await ReadOpenTokenCountAsync(provider, keep.Id)).ShouldBe(1);
        (await ReadOpenTokenCountAsync(provider, strangers.Id)).ShouldBe(1);
    }

    [Fact]
    public async Task RevokingWithNoExceptionEndsEveryActiveSessionOnce()
    {
        await using var provider = BuildProvider(new FakeTimeProvider(Now));
        var userId = await CreateUserAsync(provider);
        var first = await StartAsync(provider, userId, TokenHash.Compute("raw-none-1"));
        var second = await StartAsync(provider, userId, TokenHash.Compute("raw-none-2"));

        var revoked = await RevokeAllAsync(provider, userId, null, Now, SessionRevocationReason.PasswordReset);

        revoked.ShouldBe([first.Id, second.Id], ignoreOrder: true);
        (await ReadSessionAsync(provider, first.Id)).RevokedReason.ShouldBe(SessionRevocationReason.PasswordReset);
        (await RevokeAllAsync(provider, userId, null, Now.AddSeconds(1), SessionRevocationReason.PasswordReset)).ShouldBeEmpty();
    }

    private static async Task<RefreshLookup> FindAsync(ServiceProvider provider, byte[] hash)
    {
        await using var scope = provider.CreateAsyncScope();
        return (await scope.ServiceProvider.GetRequiredService<ISessions>()
            .FindByRefreshHashAsync(hash, TestContext.Current.CancellationToken)).ShouldNotBeNull();
    }

    private static async Task RotateAsync(ServiceProvider provider, byte[] presentedHash, byte[] newHash, DateTimeOffset now)
    {
        await using var scope = provider.CreateAsyncScope();
        var sessions = scope.ServiceProvider.GetRequiredService<ISessions>();
        var lookup = (await sessions.FindByRefreshHashAsync(presentedHash, TestContext.Current.CancellationToken)).ShouldNotBeNull();
        var result = lookup.Session.Rotate(lookup.Presented, lookup.Related, newHash, now, Settings);
        result.Outcome.ShouldBe(RotationOutcome.Rotated);
        sessions.AddToken(result.NewToken.ShouldNotBeNull());
        await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static async Task<IReadOnlyList<Guid>> RevokeAllAsync(
        ServiceProvider provider,
        Guid userId,
        Guid? exceptSessionId,
        DateTimeOffset now,
        SessionRevocationReason reason = SessionRevocationReason.SignedOutOtherDevices)
    {
        await using var scope = provider.CreateAsyncScope();
        var revoked = await scope.ServiceProvider.GetRequiredService<ISessions>()
            .RevokeAllAsync(userId, exceptSessionId, reason, now, TestContext.Current.CancellationToken);
        await scope.ServiceProvider.GetRequiredService<IUnitOfWork>().SaveChangesAsync(TestContext.Current.CancellationToken);
        return revoked;
    }

    private static async Task<UserSession> ReadSessionAsync(ServiceProvider provider, Guid sessionId)
    {
        await using var scope = provider.CreateAsyncScope();
        return (await scope.ServiceProvider.GetRequiredService<ISessions>().FindAsync(sessionId, TestContext.Current.CancellationToken)).ShouldNotBeNull();
    }

    private static async Task<int> ReadOpenTokenCountAsync(ServiceProvider provider, Guid sessionId)
    {
        await using var scope = provider.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<CspsDbContext>().RefreshTokens
            .CountAsync(token => token.SessionId == sessionId && token.ConsumedAt == null && token.RevokedAt == null, TestContext.Current.CancellationToken);
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
