using System.Data;
using System.Globalization;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Trial;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck;

/// <summary>
/// The end-to-end run: read the legacy restore, map each order, import it into a throwaway trial database, drop that database,
/// and write the full findings under _local. The console gets counts and a relative path only, and a failure names the exception
/// type only, because console text can reach logs and transcripts.
/// </summary>
internal static class FitCheckRunner
{
    public static async Task<int> RunAsync(
        FitCheckTargets targets,
        string localRoot,
        TimeProvider time,
        TextWriter output,
        TextWriter error,
        CancellationToken cancellationToken,
        FitCheckHooks? hooks = null)
    {
        ArgumentNullException.ThrowIfNull(targets);
        ArgumentNullException.ThrowIfNull(time);
        ArgumentNullException.ThrowIfNull(output);
        ArgumentNullException.ThrowIfNull(error);

        var sourceCheck = LegacySource.Check(targets.SourceConnectionString);
        if (!sourceCheck.Allowed)
        {
            await error.WriteLineAsync($"Refused: {sourceCheck.Reason}").ConfigureAwait(false);
            return Program.Refused;
        }

        try
        {
            var read = await ReadAndMapAsync(LegacySource.Prepare(targets.SourceConnectionString), hooks, cancellationToken).ConfigureAwait(false);
            if (WriteEvidence.Compare(read.Before, read.After) == WriteEvidenceVerdict.Changed)
            {
                await error.WriteLineAsync("Failed: the restore changed during the run.").ConfigureAwait(false);
                return Program.Failed;
            }

            var mapped = read.Orders;
            var findings = mapped.SelectMany(static order => order.Findings).ToList();
            findings.Add(EvidenceFinding(read.Before));

            var trialName = TrialDatabaseName.NewName();
            try
            {
                await TrialDatabase.CreateAsync(targets.TrialServerConnectionString, trialName, cancellationToken).ConfigureAwait(false);
                if (hooks?.AfterTrialCreated is { } afterCreated)
                {
                    await afterCreated(trialName, cancellationToken).ConfigureAwait(false);
                }

                var trialConnection = TrialDatabase.ConnectionStringFor(targets.TrialServerConnectionString, trialName);
                findings.AddRange(await TrialImport.RunAsync(trialConnection, mapped, time, cancellationToken).ConfigureAwait(false));
            }
            finally
            {
                await TrialDatabase.DropAsync(targets.TrialServerConnectionString, trialName).ConfigureAwait(false);
            }

            var path = await FindingsWriter.WriteAsync(localRoot, findings, time, cancellationToken).ConfigureAwait(false);
            var problems = findings.Count(static finding => finding.Type != FindingType.Info);
            await output.WriteLineAsync(string.Create(CultureInfo.InvariantCulture, $"Orders checked: {mapped.Count}. Findings: {problems}.")).ConfigureAwait(false);
            await output.WriteLineAsync($"Full list (never commit): {path}").ConfigureAwait(false);
            return Program.Succeeded;
        }
        catch (Exception exception)
        {
            await error.WriteLineAsync($"Failed: {exception.GetType().Name}").ConfigureAwait(false);
            return Program.Failed;
        }
    }

    private static Finding EvidenceFinding(WriteEvidenceSnapshot snapshot) =>
        new(
            RecordKind.Run,
            "Run",
            FindingType.Info,
            "write-evidence",
            null,
            string.Create(CultureInfo.InvariantCulture, $"Write evidence: unchanged ({snapshot.Tables} tables, {snapshot.Rows} rows, {snapshot.UserUpdates} index updates before and after)"),
            null,
            null);

    private static async Task<ReadResult> ReadAndMapAsync(string sourceConnectionString, FitCheckHooks? hooks, CancellationToken cancellationToken)
    {
        var source = LegacyDbContext.Open(sourceConnectionString);
        await using (source.ConfigureAwait(false))
        {
            // One transaction around the whole read window, never committed: disposal rolls it back. It also keeps one connection
            // open, because a database with auto-close resets its index usage counters when the last connection closes.
            var transaction = await source.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken).ConfigureAwait(false);
            await using (transaction.ConfigureAwait(false))
            {
                return await ReadWindowAsync(source, hooks, cancellationToken).ConfigureAwait(false);
            }
        }
    }

    private static async Task<ReadResult> ReadWindowAsync(LegacyDbContext source, FitCheckHooks? hooks, CancellationToken cancellationToken)
    {
        var before = await WriteEvidence.CaptureAsync(source, cancellationToken).ConfigureAwait(false);
        var types = await source.OrderTypes.ToDictionaryAsync(static row => row.OrderTypeId, static row => row.OrderTypeName, cancellationToken).ConfigureAwait(false);
        var statuses = await source.Statuses.ToDictionaryAsync(static row => row.StatusId, static row => row.StatusName, cancellationToken).ConfigureAwait(false);
        var orders = await source.Orders.OrderBy(static row => row.OrderId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var items = (await source.OrderItems.OrderBy(static row => row.OrderItemId).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(static row => row.OrderId);

        var mapped = orders.Select(order => DraftMapping.MapOrder(order, [.. items[order.OrderId]], types, statuses)).ToList();

        if (hooks?.BetweenEvidence is { } between)
        {
            await between(cancellationToken).ConfigureAwait(false);
        }

        var after = await WriteEvidence.CaptureAsync(source, cancellationToken).ConfigureAwait(false);
        return new ReadResult(mapped, before, after);
    }

    private sealed record ReadResult(IReadOnlyList<MappedOrder> Orders, WriteEvidenceSnapshot Before, WriteEvidenceSnapshot After);
}
