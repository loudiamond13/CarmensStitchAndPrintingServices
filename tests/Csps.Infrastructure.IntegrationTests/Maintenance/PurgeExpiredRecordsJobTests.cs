using System.Data.Common;
using System.Security.Cryptography;
using Csps.Application.Email;
using Csps.Application.Maintenance;
using Csps.Domain.Identity;
using Csps.Infrastructure.Email;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Idempotency;
using Csps.Infrastructure.Maintenance;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Maintenance;

/// <summary>SEC-06, JOB-01: the purge removes only rows past their own expiry, in batches of 500, and stops between batches when the budget is spent.</summary>
public sealed class PurgeExpiredRecordsJobTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private const string PurgeLabel = "Expired request keys removed";
    private const string SessionsLabel = "Expired sign-in tokens removed";
    private const string ChallengesLabel = "Expired 2FA codes removed";
    private const string LinksLabel = "Expired account links removed";
    private const string OutboxLabel = "Old sent emails removed";

    private static readonly DateTimeOffset Now = new(2026, 11, 3, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan ClaimLease = TimeSpan.FromMinutes(2);
    private static readonly TimeSpan SessionMargin = TimeSpan.FromDays(1);
    private static readonly TimeSpan SessionLifetime = TimeSpan.FromHours(12);
    private static readonly SessionSettings Sessions = new() { BrowserSessionLifetime = SessionLifetime };
    private static readonly TimeSpan ChallengeMargin = TimeSpan.FromDays(1);
    private static readonly TimeSpan ChallengeLifetime = TimeSpan.FromMinutes(30);
    private static readonly TwoFactorSettings Challenges = new() { ChallengeLifetime = ChallengeLifetime };
    private static readonly TimeSpan LinkMargin = TimeSpan.FromDays(7);
    private static readonly TimeSpan LinkLifetime = TimeSpan.FromMinutes(30);
    private static readonly TimeSpan OutboxRetention = TimeSpan.FromDays(30);

    [Fact]
    public async Task ABigBacklogIsRemovedInBatchesOf500WhenTheBudgetAllows()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var counter = new CommandCounter();
        var clock = new FakeTimeProvider(Now);

        var report = await RunAsync(clock, counter);

        PurgeBatchSize.ShouldBe(500);
        var line = Line(report, PurgeLabel);
        line.Label.ShouldBe(PurgeLabel);
        line.Value.ShouldBe(1200);
        line.Failed.ShouldBeFalse();
        report.More.ShouldBeFalse();
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("IdempotencyRecords", StringComparison.Ordinal)).ShouldBe(3);
        (await CountRecordsAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task ASpentBudgetAfterOneBatchStopsWithMoreAnd500Removed()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var clock = new FakeTimeProvider(Now);
        var budget = new MaintenanceBudget(clock);
        var spendAfterFirstDelete = new AdvanceAfterFirstDelete(clock, MaintenanceBudget.DefaultDuration);

        var report = await RunAsync(clock, spendAfterFirstDelete, budget);

        var line = Line(report, PurgeLabel);
        line.Value.ShouldBe(500);
        line.Failed.ShouldBeFalse();
        report.More.ShouldBeTrue();
        (await CountRecordsAsync()).ShouldBe(700);
    }

    [Fact]
    public async Task TheNextCallFinishesTheWorkTheBudgetCutOff()
    {
        await database.ResetAsync();
        await StoreRecordsAsync(1200, expiresAt: Now - TimeSpan.FromHours(1));
        var clock = new FakeTimeProvider(Now);
        await RunAsync(clock, new AdvanceAfterFirstDelete(clock, MaintenanceBudget.DefaultDuration), new MaintenanceBudget(clock));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, PurgeLabel).Value.ShouldBe(700);
        report.More.ShouldBeFalse();
        (await CountRecordsAsync()).ShouldBe(0);
    }

    [Fact]
    public async Task ARecordExpiringExactlyNowIsRemovedAndOneExpiringATickLaterStays()
    {
        await database.ResetAsync();
        var gone = await StoreRecordAsync(Now);
        var kept = await StoreRecordAsync(Now + TimeSpan.FromTicks(1));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, PurgeLabel).Value.ShouldBe(1);
        var left = await ReadRecordKeysAsync();
        left.ShouldContain(kept);
        left.ShouldNotContain(gone);
    }

    [Fact]
    public async Task ExpiredClaimsGoAndLiveClaimsAndStandingLocksStay()
    {
        await database.ResetAsync();
        await ClearClaimsAsync();
        await StoreClaimsAsync(("idem:expired-exactly-now", Now - ClaimLease), ("idem:expired-long-ago", Now - TimeSpan.FromHours(2)), ("idem:live", Now + TimeSpan.FromMinutes(1)), ("idem:live-by-a-tick", Now + TimeSpan.FromTicks(1)));
        var standingBefore = await CountStandingLocksAsync();

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, PurgeLabel).Value.ShouldBe(2);
        (await ReadClaimNamesAsync()).Order().ToArray().ShouldBe(["idem:live", "idem:live-by-a-tick"]);
        (await CountStandingLocksAsync()).ShouldBe(standingBefore);
        standingBefore.ShouldBeGreaterThan(0);
    }

    [Fact]
    public async Task RecordsAndClaimsAddUpInOneLine()
    {
        await database.ResetAsync();
        await ClearClaimsAsync();
        await StoreRecordsAsync(3, expiresAt: Now - TimeSpan.FromHours(1));
        await StoreClaimsAsync(("idem:old-a", Now - TimeSpan.FromHours(1)), ("idem:old-b", Now - TimeSpan.FromHours(1)));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, PurgeLabel).Value.ShouldBe(5);
    }

    [Fact]
    public async Task ASessionEndedMoreThanADayAgoIsRemovedAndOneAtTheCutOffStays()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        var gone = await StoreSessionAsync(userId, Now - SessionMargin - TimeSpan.FromSeconds(1));
        var atCutOff = await StoreSessionAsync(userId, Now - SessionMargin);
        var fresh = await StoreSessionAsync(userId, Now + TimeSpan.FromHours(1));

        var report = await RunAsync(new FakeTimeProvider(Now));

        var line = Line(report, SessionsLabel);
        line.Value.ShouldBe(1);
        line.Failed.ShouldBeFalse();
        var left = await ReadSessionIdsAsync();
        left.Order().ToArray().ShouldBe(new[] { atCutOff, fresh }.Order().ToArray());
        left.ShouldNotContain(gone);
    }

    [Fact]
    public async Task ARemovedSessionTakesAllItsRefreshTokensAndALiveSessionKeepsItsUsedOnes()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        var ended = await StoreSessionAsync(userId, Now - TimeSpan.FromDays(3), rotations: 2);
        var live = await StoreSessionAsync(userId, Now + TimeSpan.FromHours(1), rotations: 2);

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, SessionsLabel).Value.ShouldBe(1);
        (await CountTokensAsync(ended)).ShouldBe(0);
        (await CountTokensAsync(live)).ShouldBe(3);
        (await CountConsumedTokensAsync(live)).ShouldBe(2);
    }

    [Fact]
    public async Task ElevenHundredEndedSessionsAreRemovedInThreeBatches()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        await StoreSessionsAsync(userId, 1100, Now - TimeSpan.FromDays(2));
        var counter = new CommandCounter();

        var report = await RunAsync(new FakeTimeProvider(Now), counter);

        Line(report, SessionsLabel).Value.ShouldBe(1100);
        report.More.ShouldBeFalse();
        counter.Commands.Count(static command => command.Contains("DELETE", StringComparison.Ordinal) && command.Contains("UserSessions", StringComparison.Ordinal)).ShouldBe(3);
        (await ReadSessionIdsAsync()).ShouldBeEmpty();
    }

    [Fact]
    public async Task ASpentBudgetAfterTheFirstSessionBatchStopsWithMore()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        await StoreSessionsAsync(userId, 1100, Now - TimeSpan.FromDays(2));
        var clock = new FakeTimeProvider(Now);
        var spend = new AdvanceAfterFirstDelete(clock, MaintenanceBudget.DefaultDuration, "UserSessions");

        var report = await RunAsync(clock, spend, new MaintenanceBudget(clock));

        Line(report, SessionsLabel).Value.ShouldBe(500);
        report.More.ShouldBeTrue();
        (await ReadSessionIdsAsync()).Count.ShouldBe(600);
    }

    [Fact]
    public async Task AChallengeExpiredMoreThanADayAgoIsRemovedAndOneAtTheCutOffStays()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        var gone = await StoreChallengeAsync(userId, Now - ChallengeMargin - TimeSpan.FromSeconds(1));
        var atCutOff = await StoreChallengeAsync(userId, Now - ChallengeMargin);
        var fresh = await StoreChallengeAsync(userId, Now + TimeSpan.FromMinutes(5));

        var report = await RunAsync(new FakeTimeProvider(Now));

        var line = Line(report, ChallengesLabel);
        line.Value.ShouldBe(1);
        line.Failed.ShouldBeFalse();
        var left = await ReadChallengeIdsAsync();
        left.Order().ToArray().ShouldBe(new[] { atCutOff, fresh }.Order().ToArray());
        left.ShouldNotContain(gone);
    }

    [Fact]
    public async Task ARemovedChallengeTakesItsCodesAndAKeptOneKeepsThem()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        var gone = await StoreChallengeAsync(userId, Now - TimeSpan.FromDays(2));
        var kept = await StoreChallengeAsync(userId, Now - TimeSpan.FromHours(2));

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, ChallengesLabel).Value.ShouldBe(1);
        (await CountCodesAsync(gone)).ShouldBe(0);
        (await CountCodesAsync(kept)).ShouldBe(1);
    }

    [Fact]
    public async Task AnAccountLinkExpiredMoreThanSevenDaysAgoIsRemovedAndOneAtTheCutOffStays()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        var gone = await StoreLinkAsync(userId, Now - LinkMargin - TimeSpan.FromSeconds(1));
        var atCutOff = await StoreLinkAsync(userId, Now - LinkMargin);
        var recent = await StoreLinkAsync(userId, Now - TimeSpan.FromDays(2));
        var live = await StoreLinkAsync(userId, Now + TimeSpan.FromMinutes(5));

        var report = await RunAsync(new FakeTimeProvider(Now));

        var line = Line(report, LinksLabel);
        line.Value.ShouldBe(1);
        line.Failed.ShouldBeFalse();
        var left = await ReadLinkIdsAsync();
        left.Order().ToArray().ShouldBe(new[] { atCutOff, recent, live }.Order().ToArray());
        left.ShouldNotContain(gone);
    }

    [Fact]
    public async Task AClosedEmailGoesThirtyDaysAfterItClosedWhicheverWayItClosed()
    {
        await database.ResetAsync();
        var stays = new List<Guid>();
        var goes = new List<Guid>();
        foreach (var close in new Action<EmailOutboxMessage, DateTimeOffset>[] { CloseAsSent, CloseAsFailed, CloseAsExpired })
        {
            stays.Add(await StoreEmailAsync(Now - OutboxRetention, close));
            goes.Add(await StoreEmailAsync(Now - OutboxRetention - TimeSpan.FromSeconds(1), close));
        }

        var report = await RunAsync(new FakeTimeProvider(Now));

        var line = Line(report, OutboxLabel);
        line.Value.ShouldBe(3);
        line.Failed.ShouldBeFalse();
        var left = await ReadEmailIdsAsync();
        left.Order().ToArray().ShouldBe(stays.Order().ToArray());
        goes.ShouldAllBe(id => !left.Contains(id));
    }

    [Fact]
    public async Task AnOpenEmailStaysAndRecentClosedOnesStay()
    {
        await database.ResetAsync();
        var open = await StoreEmailAsync(Now - TimeSpan.FromDays(90), close: null);
        var failedRecently = await StoreEmailAsync(Now - TimeSpan.FromDays(29), CloseAsFailed);
        var sentLongAgo = await StoreEmailAsync(Now - TimeSpan.FromDays(31), CloseAsSent);

        var report = await RunAsync(new FakeTimeProvider(Now));

        Line(report, OutboxLabel).Value.ShouldBe(1);
        var left = await ReadEmailIdsAsync();
        left.Order().ToArray().ShouldBe(new[] { open, failedRecently }.Order().ToArray());
        left.ShouldNotContain(sentLongAgo);
    }

    [Fact]
    public async Task EveryRuleReportsItsLineInOrderEvenWhenNothingIsDue()
    {
        await database.ResetAsync();

        var report = await RunAsync(new FakeTimeProvider(Now));

        report.Lines.Select(static line => line.Label).ToArray().ShouldBe([PurgeLabel, SessionsLabel, ChallengesLabel, LinksLabel, OutboxLabel]);
        report.Lines.ShouldAllBe(static line => line.Value == 0 && !line.Failed);
        report.More.ShouldBeFalse();
    }

    [Fact]
    public async Task AFailedSessionPurgeGivesOneFailedLineAndTheOtherPurgesStillRun()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        await StoreSessionAsync(userId, Now - TimeSpan.FromDays(3));
        await StoreChallengeAsync(userId, Now - TimeSpan.FromDays(3));
        await StoreLinkAsync(userId, Now - TimeSpan.FromDays(10));
        await StoreEmailAsync(Now - TimeSpan.FromDays(40), CloseAsSent);

        var report = await RunAsync(new FakeTimeProvider(Now), new FailDeletesOn("UserSessions"));

        var failed = Line(report, SessionsLabel);
        failed.Failed.ShouldBeTrue();
        failed.Value.ShouldBeNull();
        failed.Text.ShouldBe("The expired sign-in tokens could not be removed.");
        Line(report, ChallengesLabel).Value.ShouldBe(1);
        Line(report, LinksLabel).Value.ShouldBe(1);
        Line(report, OutboxLabel).Value.ShouldBe(1);
        report.More.ShouldBeFalse();
        (await ReadSessionIdsAsync()).Count.ShouldBe(1);
    }

    [Fact]
    public async Task AFailedRequestKeyPurgeDoesNotStopTheLaterPurges()
    {
        await database.ResetAsync();
        var userId = await CreateUserAsync();
        await StoreSessionAsync(userId, Now - TimeSpan.FromDays(3));

        var report = await RunAsync(new FakeTimeProvider(Now), new FailDeletesOn("IdempotencyRecords"));

        Line(report, PurgeLabel).Failed.ShouldBeTrue();
        Line(report, SessionsLabel).Value.ShouldBe(1);
    }

    private static int PurgeBatchSize => PurgeExpiredRecordsJob.BatchSize;

    private static void CloseAsSent(EmailOutboxMessage message, DateTimeOffset at) => message.MarkSent(at);

    private static void CloseAsFailed(EmailOutboxMessage message, DateTimeOffset at) => message.MarkFailed(at, "test-failure");

    private static void CloseAsExpired(EmailOutboxMessage message, DateTimeOffset at) => message.MarkExpired(at);

    private static MaintenanceLine Line(MaintenanceJobReport report, string label) => report.Lines.Single(line => line.Label == label);

    private async Task<MaintenanceJobReport> RunAsync(FakeTimeProvider clock, IInterceptor? hook = null, MaintenanceBudget? budget = null)
    {
        await using var context = hook is null ? database.CreateContext() : database.CreateContext(hook);
        var job = new PurgeExpiredRecordsJob(context, clock, NullLogger<PurgeExpiredRecordsJob>.Instance);
        return await job.RunAsync(budget ?? new MaintenanceBudget(clock), TestContext.Current.CancellationToken);
    }

    private async Task<Guid> CreateUserAsync()
    {
        var id = Guid.NewGuid();
        var email = $"staff.{id:N}@example.test";
        await using var context = database.CreateContext();
        context.Users.Add(new ApplicationUser
        {
            Id = id,
            UserName = email,
            NormalizedUserName = email.ToUpperInvariant(),
            Email = email,
            NormalizedEmail = email.ToUpperInvariant(),
            SecurityStamp = Guid.NewGuid().ToString("N"),
            CreatedAtUtc = Now,
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return id;
    }

    // A browser session lasts SessionLifetime from its start, so the start is set back to land on the wanted end.
    // Each rotation uses the newest token and adds its child, so a session with n rotations holds n + 1 tokens.
    private async Task<Guid> StoreSessionAsync(Guid userId, DateTimeOffset absoluteExpiresAt, int rotations = 0)
    {
        var start = absoluteExpiresAt - SessionLifetime;
        var (session, first) = UserSession.Start(userId, persistent: false, "Test browser", RandomNumberGenerator.GetBytes(TokenHash.HashLength), start, Sessions);
        var tokens = new List<RefreshToken> { first };
        for (var index = 0; index < rotations; index++)
        {
            var result = session.Rotate(tokens[^1], tokens, RandomNumberGenerator.GetBytes(TokenHash.HashLength), start.AddMinutes(index + 1), Sessions);
            tokens.Add(result.NewToken.ShouldNotBeNull());
        }

        await using var context = database.CreateContext();
        context.Add(session);
        context.AddRange(tokens);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return session.Id;
    }

    private async Task StoreSessionsAsync(Guid userId, int count, DateTimeOffset absoluteExpiresAt)
    {
        await using var context = database.CreateContext();
        for (var index = 0; index < count; index++)
        {
            var (session, token) = UserSession.Start(userId, persistent: false, "Test browser", RandomNumberGenerator.GetBytes(TokenHash.HashLength), absoluteExpiresAt - SessionLifetime, Sessions);
            context.Add(session);
            context.Add(token);
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<Guid>> ReadSessionIdsAsync()
    {
        await using var context = database.CreateContext();
        return await context.UserSessions.AsNoTracking().Select(session => session.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountTokensAsync(Guid sessionId)
    {
        await using var context = database.CreateContext();
        return await context.RefreshTokens.CountAsync(token => token.SessionId == sessionId, TestContext.Current.CancellationToken);
    }

    private async Task<int> CountConsumedTokensAsync(Guid sessionId)
    {
        await using var context = database.CreateContext();
        return await context.RefreshTokens.CountAsync(token => token.SessionId == sessionId && token.ConsumedAt != null, TestContext.Current.CancellationToken);
    }

    // A challenge lives ChallengeLifetime from its start, so the start is set back to land on the wanted expiry. It holds one code.
    private async Task<Guid> StoreChallengeAsync(Guid userId, DateTimeOffset expiresAt)
    {
        var start = expiresAt - ChallengeLifetime;
        var challenge = TwoFactorChallenge.Start(userId, RandomNumberGenerator.GetBytes(TokenHash.HashLength), persistent: false, start, Challenges);
        challenge.IssueCode(RandomNumberGenerator.GetBytes(TokenHash.HashLength), start, Challenges);
        await using var context = database.CreateContext();
        context.Add(challenge);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return challenge.Id;
    }

    private async Task<IReadOnlyList<Guid>> ReadChallengeIdsAsync()
    {
        await using var context = database.CreateContext();
        return await context.TwoFactorChallenges.AsNoTracking().Select(challenge => challenge.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountCodesAsync(Guid challengeId)
    {
        await using var context = database.CreateContext();
        return await context.TwoFactorCodes.CountAsync(code => code.ChallengeId == challengeId, TestContext.Current.CancellationToken);
    }

    private async Task<Guid> StoreLinkAsync(Guid userId, DateTimeOffset expiresAt)
    {
        var link = AccountToken.Create(userId, AccountTokenPurpose.PasswordReset, RandomNumberGenerator.GetBytes(TokenHash.HashLength), expiresAt - LinkLifetime, LinkLifetime);
        await using var context = database.CreateContext();
        context.Add(link);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return link.Id;
    }

    private async Task<IReadOnlyList<Guid>> ReadLinkIdsAsync()
    {
        await using var context = database.CreateContext();
        return await context.AccountTokens.AsNoTracking().Select(link => link.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    // A queued email is closed at closedAt (sent, failed or expired), or left open when close is null.
    private async Task<Guid> StoreEmailAsync(DateTimeOffset closedAt, Action<EmailOutboxMessage, DateTimeOffset>? close)
    {
        var created = closedAt - TimeSpan.FromHours(1);
        var message = EmailOutboxMessage.Queue(Guid.CreateVersion7(created), AuthEmailKind.SignInCode, "staff@example.test", "subject", "text", "html", created, created.AddHours(1));
        close?.Invoke(message, closedAt);
        await using var context = database.CreateContext();
        context.Add(message);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return message.Id;
    }

    private async Task<IReadOnlyList<Guid>> ReadEmailIdsAsync()
    {
        await using var context = database.CreateContext();
        return await context.EmailOutbox.AsNoTracking().Select(message => message.Id).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task StoreRecordsAsync(int count, DateTimeOffset expiresAt)
    {
        await using var context = database.CreateContext();
        for (var index = 0; index < count; index++)
        {
            context.Add(NewRecord(Guid.NewGuid(), expiresAt));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Guid> StoreRecordAsync(DateTimeOffset expiresAt)
    {
        var key = Guid.NewGuid();
        await using var context = database.CreateContext();
        context.Add(NewRecord(key, expiresAt));
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return key;
    }

    // A record lives IdempotencyRecord.Lifetime from its creation time, so the creation time is set back to land on the wanted expiry.
    private static IdempotencyRecord NewRecord(Guid key, DateTimeOffset expiresAt) =>
        IdempotencyRecord.Create(key, null, "POST /test/purge", new byte[32], 200, null, null, null, expiresAt - IdempotencyRecord.Lifetime);

    private async Task StoreClaimsAsync(params (string Name, DateTimeOffset ExpiresAt)[] claims)
    {
        await using var context = database.CreateContext();
        foreach (var (name, expiresAt) in claims)
        {
            context.Add(DatabaseLock.Claim(name, Guid.NewGuid(), expiresAt - ClaimLease, ClaimLease));
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task ClearClaimsAsync()
    {
        await using var context = database.CreateContext();
        await context.Set<DatabaseLock>().Where(claim => claim.ExpiresAtUtc != null).ExecuteDeleteAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountRecordsAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().CountAsync(TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<Guid>> ReadRecordKeysAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<IdempotencyRecord>().AsNoTracking().Select(record => record.Key).ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<IReadOnlyList<string>> ReadClaimNamesAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().AsNoTracking()
            .Where(claim => claim.ExpiresAtUtc != null)
            .Select(claim => claim.Name)
            .ToListAsync(TestContext.Current.CancellationToken);
    }

    private async Task<int> CountStandingLocksAsync()
    {
        await using var context = database.CreateContext();
        return await context.Set<DatabaseLock>().CountAsync(claim => claim.ExpiresAtUtc == null, TestContext.Current.CancellationToken);
    }

    // Fails every delete on one table with a database error.
    private sealed class FailDeletesOn(string table) : DbCommandInterceptor
    {
        public override ValueTask<InterceptionResult<int>> NonQueryExecutingAsync(
            DbCommand command, CommandEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE", StringComparison.Ordinal) && command.CommandText.Contains(table, StringComparison.Ordinal))
            {
                throw new TestDatabaseException();
            }

            return base.NonQueryExecutingAsync(command, eventData, result, cancellationToken);
        }
    }

    private sealed class TestDatabaseException() : DbException("The test database failed.");

    // Moves the clock forward once the first delete on the table has run, as if that batch took the whole budget.
    private sealed class AdvanceAfterFirstDelete(FakeTimeProvider clock, TimeSpan by, string table = "IdempotencyRecords") : DbCommandInterceptor
    {
        private int _advanced;

        public override ValueTask<int> NonQueryExecutedAsync(
            DbCommand command, CommandExecutedEventData eventData, int result, CancellationToken cancellationToken = default)
        {
            if (command.CommandText.Contains("DELETE", StringComparison.Ordinal) && command.CommandText.Contains(table, StringComparison.Ordinal) && Interlocked.Exchange(ref _advanced, 1) == 0)
            {
                clock.Advance(by);
            }

            return base.NonQueryExecutedAsync(command, eventData, result, cancellationToken);
        }
    }
}
