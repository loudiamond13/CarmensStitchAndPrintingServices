using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Tests.Fakes;

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
                var before = await WriteEvidence.CaptureAsync(context, token);
                var after = await WriteEvidence.CaptureAsync(context, token);

                before.Tables.ShouldBe(4);
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
                var before = await WriteEvidence.CaptureAsync(context, token);
                await fake.AddOrderAsync(2, token);
                var after = await WriteEvidence.CaptureAsync(context, token);

                after.Rows.ShouldBe(before.Rows + 1);
                WriteEvidence.Compare(before, after).ShouldBe(WriteEvidenceVerdict.Changed);
            }
        }
    }
}
