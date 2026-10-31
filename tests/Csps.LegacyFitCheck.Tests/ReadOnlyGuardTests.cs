using System.Data;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace Csps.LegacyFitCheck.Tests;

public sealed class ReadOnlyGuardTests
{
    public static TheoryData<CommandSource> EveryOtherSource() =>
        [.. Enum.GetValues<CommandSource>().Where(source => source != CommandSource.LinqQuery)];

    [Theory]
    [InlineData("SELECT [o].[OrderId] FROM [Orders] AS [o]")]
    [InlineData("select 1")]
    [InlineData("  \r\n\t SELECT 1")]
    public void ALinqSelectIsAllowed(string text) => ReadOnlyCommandGuard.IsAllowedRead(CommandSource.LinqQuery, text).ShouldBeTrue();

    [Theory]
    [InlineData("DELETE FROM [Orders]")]
    [InlineData("UPDATE [Orders] SET [OrderName] = N'x'")]
    [InlineData("INSERT INTO [Orders] ([OrderId]) VALUES (1)")]
    [InlineData("EXEC sp_who")]
    [InlineData("WITH [c] AS (SELECT 1) DELETE FROM [Orders]")]
    [InlineData("")]
    [InlineData("   ")]
    public void ALinqCommandThatIsNotASelectIsRefused(string text) => ReadOnlyCommandGuard.IsAllowedRead(CommandSource.LinqQuery, text).ShouldBeFalse();

    [Theory]
    [MemberData(nameof(EveryOtherSource))]
    public void EveryOtherCommandSourceIsRefusedWhateverTheText(CommandSource source) =>
        ReadOnlyCommandGuard.IsAllowedRead(source, "SELECT 1").ShouldBeFalse();

    [Fact]
    public async Task ALinqReadOnTheGuardedContextWorks()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                (await context.Orders.CountAsync(token)).ShouldBe(1);
                (await context.OrderItems.CountAsync(token)).ShouldBe(2);
            }
        }
    }

    [Fact]
    public async Task SaveChangesIsRefused()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                await Should.ThrowAsync<InvalidOperationException>(() => context.SaveChangesAsync(token));
                await Should.ThrowAsync<InvalidOperationException>(() => context.SaveChangesAsync(acceptAllChangesOnSuccess: false, token));
                Should.Throw<InvalidOperationException>(() => context.SaveChanges());
            }

            (await fake.CountAsync(token)).ShouldBe((1, 2));
        }
    }

    [Fact]
    public async Task BulkDeleteAndBulkUpdateAreRefusedAndChangeNothing()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                await Should.ThrowAsync<InvalidOperationException>(() => context.Orders.ExecuteDeleteAsync(token));
                await Should.ThrowAsync<InvalidOperationException>(
                    () => context.Orders.ExecuteUpdateAsync(set => set.SetProperty(row => row.OrderName, "changed"), token));
            }

            (await fake.CountAsync(token)).ShouldBe((1, 2));
            (await fake.OrderNameAsync(1, token)).ShouldBe(FakeLegacyDatabase.SentinelName + " Club");
        }
    }

    [Fact]
    public async Task RawSqlCommandsAreRefusedAndChangeNothing()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                // Raw SQL appears here only to prove the guard refuses it; the tool itself holds none.
                await Should.ThrowAsync<InvalidOperationException>(() => context.Database.ExecuteSqlRawAsync("DELETE FROM [Orders]", token));
                await Should.ThrowAsync<InvalidOperationException>(async () => await context.Set<LegacyOrderRow>().FromSqlRaw("SELECT * FROM [Orders]").ToListAsync(token));
                await Should.ThrowAsync<InvalidOperationException>(async () => await context.Database.SqlQueryRaw<int>("SELECT 1 AS [Value]").ToListAsync(token));
            }

            (await fake.CountAsync(token)).ShouldBe((1, 2));
        }
    }

    [Fact]
    public async Task AReadInsideAnUncommittedTransactionSeesTheRowsAndLeavesNothingBehind()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                var transaction = await context.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, token);
                await using (transaction.ConfigureAwait(true))
                {
                    (await context.Orders.CountAsync(token)).ShouldBe(1);
                }
            }

            (await fake.CountAsync(token)).ShouldBe((1, 2));
        }
    }
}
