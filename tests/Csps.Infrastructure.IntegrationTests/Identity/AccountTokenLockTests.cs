using System.Security.Cryptography;
using Csps.Domain.Identity;
using Csps.Infrastructure.Identity;
using Csps.Infrastructure.Persistence;
using Csps.Infrastructure.Persistence.Locking;
using Csps.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Time.Testing;

namespace Csps.Infrastructure.IntegrationTests.Identity;

/// <summary>
/// D-50, AUTH-08: the per-person lock is one of 64 fixed lock rows, so two link requests for one person at the same moment
/// leave exactly one usable link, and two people who share a row only take turns.
/// </summary>
public sealed class AccountTokenLockTests(CspsDatabase database) : IClassFixture<CspsDatabase>
{
    private static readonly DateTimeOffset Now = new(2026, 10, 25, 12, 0, 0, TimeSpan.Zero);
    private static readonly TimeSpan Patience = TimeSpan.FromSeconds(20);

    [Fact]
    public async Task TwoRequestsForOnePersonLeaveExactlyOneUsableLinkEveryRound()
    {
        for (var round = 0; round < 30; round++)
        {
            var userId = await CreateUserAsync();

            await RunTogetherAsync(userId, userId);

            await AssertOneUsableOfTwoAsync(userId);
        }
    }

    [Fact]
    public async Task TwoPeopleOnTheSameLockRowBothEndWithOneUsableLinkAndNobodyFails()
    {
        for (var round = 0; round < 10; round++)
        {
            var first = await CreateUserAsync();
            var second = await CreateUserAsync(sameLockAs: first);
            DatabaseLocks.AccountStripe(second).ShouldBe(DatabaseLocks.AccountStripe(first));

            await RunTogetherAsync(first, first, second, second);

            await AssertOneUsableOfTwoAsync(first);
            await AssertOneUsableOfTwoAsync(second);
        }
    }

    [Fact]
    public async Task APersonOnAnotherLockRowDoesNotWaitForAnOpenRequest()
    {
        var holder = await CreateUserAsync();
        var other = await CreateUserAsync(differentLockFrom: holder);
        await using var holderContext = database.CreateContext();
        var transaction = await holderContext.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await new AccountTokenStore(holderContext, new FakeTimeProvider(Now)).LockAccountAsync(holder, TestContext.Current.CancellationToken);

            await RequestAsync(other).WaitAsync(Patience, TestContext.Current.CancellationToken);

            await transaction.RollbackAsync(TestContext.Current.CancellationToken);
        }

        await AssertUsableCountAsync(other, 1);
    }

    [Fact]
    public async Task LockingAnAccountWithNoOpenTransactionThrows()
    {
        await using var context = database.CreateContext();
        var store = new AccountTokenStore(context, new FakeTimeProvider(Now));

        await Should.ThrowAsync<InvalidOperationException>(() => store.LockAccountAsync(Guid.NewGuid(), TestContext.Current.CancellationToken));
    }

    private async Task RunTogetherAsync(params Guid[] requests)
    {
        var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var tasks = requests.Select(userId => Task.Run(async () =>
        {
            await gate.Task.ConfigureAwait(false);
            await RequestAsync(userId).ConfigureAwait(false);
        })).ToList();

        gate.SetResult();
        await Task.WhenAll(tasks).WaitAsync(Patience, TestContext.Current.CancellationToken);
    }

    // What the link handlers do: lock the person, revoke the open links, add a new one, commit.
    private async Task RequestAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var store = new AccountTokenStore(context, new FakeTimeProvider(Now));
        var transaction = await context.Database.BeginTransactionAsync(TestContext.Current.CancellationToken);
        await using (transaction)
        {
            await store.LockAccountAsync(userId, TestContext.Current.CancellationToken);
            await store.RevokeOpenAsync(userId, AccountTokenPurpose.PasswordReset, Now, TestContext.Current.CancellationToken);
            store.Add(AccountToken.Create(userId, AccountTokenPurpose.PasswordReset, RandomNumberGenerator.GetBytes(TokenHash.HashLength), Now, TimeSpan.FromMinutes(30)));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
            await transaction.CommitAsync(TestContext.Current.CancellationToken);
        }
    }

    private async Task AssertOneUsableOfTwoAsync(Guid userId)
    {
        await using var context = database.CreateContext();
        var rows = await context.AccountTokens.AsNoTracking().Where(token => token.UserId == userId).ToListAsync(TestContext.Current.CancellationToken);

        rows.Count.ShouldBe(2);
        rows.Count(row => row.IsUsable(Now)).ShouldBe(1);
        rows.Count(row => row.RevokedAt is not null).ShouldBe(1);
    }

    private async Task AssertUsableCountAsync(Guid userId, int expected)
    {
        await using var context = database.CreateContext();
        var rows = await context.AccountTokens.AsNoTracking().Where(token => token.UserId == userId).ToListAsync(TestContext.Current.CancellationToken);

        rows.Count(row => row.IsUsable(Now)).ShouldBe(expected);
    }

    // Draws random ids until the lock row matches (or differs from) the given person's.
    private async Task<Guid> CreateUserAsync(Guid? sameLockAs = null, Guid? differentLockFrom = null)
    {
        var id = Guid.NewGuid();
        while ((sameLockAs is { } same && DatabaseLocks.AccountStripe(id) != DatabaseLocks.AccountStripe(same))
            || (differentLockFrom is { } other && DatabaseLocks.AccountStripe(id) == DatabaseLocks.AccountStripe(other)))
        {
            id = Guid.NewGuid();
        }

        var email = $"staff.{id:N}@example.com";
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
}
