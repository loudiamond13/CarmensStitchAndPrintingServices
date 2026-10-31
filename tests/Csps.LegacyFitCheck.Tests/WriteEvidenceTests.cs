using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck.Tests;

public sealed class WriteEvidenceTests
{
    [Fact]
    public async Task CaptureTwiceWithNoWriteIsEqual()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                await context.Database.OpenConnectionAsync(token);
                var before = await WriteEvidence.CaptureAsync(context, token);
                var after = await WriteEvidence.CaptureAsync(context, token);

                before.Tables.ShouldBe(10);
                before.Rows.ShouldBe(5);
                after.ShouldBe(before);
                WriteEvidence.Compare(before, after).ShouldBe(WriteEvidenceVerdict.Unchanged);
            }
        }
    }

    [Fact]
    public async Task ACaptureAfterAnInsertDiffers()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                await context.Database.OpenConnectionAsync(token);
                var before = await WriteEvidence.CaptureAsync(context, token);
                await fake.AddOrderAsync(2, token);
                var after = await WriteEvidence.CaptureAsync(context, token);

                after.Rows.ShouldBe(before.Rows + 1);
                after.UserUpdates.ShouldBeGreaterThan(before.UserUpdates);
                WriteEvidence.Compare(before, after).ShouldBe(WriteEvidenceVerdict.Changed);
            }
        }
    }

    [Fact]
    public async Task ADatabaseTheServerDoesNotListFailsClosed()
    {
        var token = TestContext.Current.CancellationToken;
        var fake = await FakeLegacyDatabase.CreateWithOneOrderAsync(token);
        await using (fake.ConfigureAwait(true))
        {
            var context = LegacyDbContext.Open(fake.ConnectionString);
            await using (context.ConfigureAwait(true))
            {
                await context.Database.OpenConnectionAsync(token);

                (await WriteEvidence.DatabaseIdAsync(context, context.Database.GetDbConnection().Database, token)).ShouldBeGreaterThan(0);
                await Should.ThrowAsync<InvalidOperationException>(() => WriteEvidence.DatabaseIdAsync(context, "CSPS_Test_00000000-0000-0000-0000-000000000000", token));
            }
        }
    }
}
