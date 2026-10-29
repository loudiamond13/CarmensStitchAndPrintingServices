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

        try
        {
            var mapped = await ReadAndMapAsync(targets.SourceConnectionString, cancellationToken).ConfigureAwait(false);
            var findings = mapped.SelectMany(static order => order.Findings).ToList();

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

    private static async Task<IReadOnlyList<MappedOrder>> ReadAndMapAsync(string sourceConnectionString, CancellationToken cancellationToken)
    {
        var source = LegacyDbContext.Open(sourceConnectionString);
        await using (source.ConfigureAwait(false))
        {
            var types = await source.OrderTypes.ToDictionaryAsync(static row => row.OrderTypeId, static row => row.OrderTypeName, cancellationToken).ConfigureAwait(false);
            var statuses = await source.Statuses.ToDictionaryAsync(static row => row.StatusId, static row => row.StatusName, cancellationToken).ConfigureAwait(false);
            var orders = await source.Orders.OrderBy(static row => row.OrderId).ToListAsync(cancellationToken).ConfigureAwait(false);
            var items = (await source.OrderItems.OrderBy(static row => row.OrderItemId).ToListAsync(cancellationToken).ConfigureAwait(false))
                .ToLookup(static row => row.OrderId);

            return [.. orders.Select(order => DraftMapping.MapOrder(order, [.. items[order.OrderId]], types, statuses))];
        }
    }
}
