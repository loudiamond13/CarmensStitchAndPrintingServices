using System.Data;
using System.Globalization;
using Csps.Domain.OrderLists;
using Csps.LegacyFitCheck.Checks;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Csps.LegacyFitCheck.Source;
using Csps.LegacyFitCheck.Trial;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;

namespace Csps.LegacyFitCheck;

/// <summary>
/// The end-to-end run: read the legacy restore, map each order, import it into a throwaway trial database, check each company expense, drop that database,
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

        var trialCheck = TrialTarget.Check(targets.TrialServerConnectionString);
        if (!trialCheck.Allowed)
        {
            await error.WriteLineAsync($"Refused: {trialCheck.Reason}").ConfigureAwait(false);
            return Program.Refused;
        }

        var trialName = TrialDatabaseName.NewName();
        string trialConnection;
        try
        {
            trialConnection = TrialTarget.For(targets.TrialServerConnectionString, trialName, new SqlConnectionStringBuilder(targets.SourceConnectionString).InitialCatalog);
        }
        catch (InvalidOperationException refusal)
        {
            await error.WriteLineAsync($"Refused: {refusal.Message}").ConfigureAwait(false);
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

            var inventory = ColumnInventory.Check(read.Columns);
            if (inventory.Missing > 0)
            {
                // Drift (D-05): no table was read, so the full list holds the column findings only.
                var driftPath = await FindingsWriter.WriteAsync(localRoot, [.. inventory.Findings, EvidenceFinding(read.Before), InventoryFinding(inventory)], time, cancellationToken).ConfigureAwait(false);
                await output.WriteLineAsync($"Full list (never commit): {driftPath}").ConfigureAwait(false);
                await error.WriteLineAsync(string.Create(CultureInfo.InvariantCulture, $"Failed: mapped columns missing from the restore: {inventory.Missing}. No table was read.")).ConfigureAwait(false);
                return Program.Failed;
            }

            var mapped = read.Orders;
            var findings = mapped.SelectMany(static order => order.Findings).ToList();
            var clock = await new ToolCalendar(time).GetClockAsync(cancellationToken).ConfigureAwait(false);
            foreach (var order in mapped.Where(static order => order.Snapshot is not null))
            {
                findings.AddRange(OrderRuleProbe.Probe(order.LegacyKey, order.Snapshot!, clock.UtcNow, clock.Today));
                if (order.StoredTotals is { } stored)
                {
                    findings.AddRange(TotalsComparer.Check(order.LegacyKey, order.Snapshot!, stored, clock.UtcNow, clock.Today));
                }
            }

            findings.AddRange(read.CompanyExpenses.SelectMany(static expense => expense.Findings));
            findings.AddRange(read.CountedOnlyExpenses);
            findings.Add(EvidenceFinding(read.Before));
            findings.AddRange(inventory.Findings);
            findings.Add(InventoryFinding(inventory));

            bool removed;
            try
            {
                await TrialDatabase.CreateAsync(targets.TrialServerConnectionString, trialName, cancellationToken).ConfigureAwait(false);
                if (hooks?.AfterTrialCreated is { } afterCreated)
                {
                    await afterCreated(trialName, cancellationToken).ConfigureAwait(false);
                }

                findings.AddRange(await TrialImport.RunAsync(trialConnection, mapped, read.TrialEntries, read.TrialStaff, time, cancellationToken, companyExpenses: read.CompanyExpenses).ConfigureAwait(false));
                if (hooks?.BeforeTrialDropped is { } beforeDrop)
                {
                    await beforeDrop(trialName, cancellationToken).ConfigureAwait(false);
                }
            }
            finally
            {
                removed = await RemoveTrialAsync(targets.TrialServerConnectionString, trialName, error).ConfigureAwait(false);
            }

            if (!removed)
            {
                return Program.Failed;
            }

            findings.Add(new Finding(RecordKind.Run, "Run", FindingType.Info, "trial.removed", null, "Trial database removed: yes", null, null));
            var path = await FindingsWriter.WriteAsync(localRoot, findings, time, cancellationToken).ConfigureAwait(false);
            var problems = findings.Count(static finding => finding.Type != FindingType.Info);
            await output.WriteLineAsync(string.Create(CultureInfo.InvariantCulture, $"Orders checked: {mapped.Count}. Company expenses checked: {read.CompanyExpenses.Count}. Findings: {problems}.")).ConfigureAwait(false);
            await output.WriteLineAsync($"Full list (never commit): {path}").ConfigureAwait(false);

            var facts = new SummaryFacts(mapped.Count, read.CompanyExpenses.Count, read.Before.Tables, read.Before.Rows, read.Before.UserUpdates, inventory.ColumnsRead, inventory.Unknown, inventory.Missing, TrialRemoved: true);
            var summary = SummaryRenderer.Render(findings, facts, read.AllowedWords, time.GetLocalNow());
            var readValues = read.ReadValues.Concat(mapped.Where(static order => order.Snapshot is not null).Select(static order => order.Snapshot!.Number));
            if (PrivacySelfCheck.Check(summary, readValues, read.AllowedWords) != PrivacyVerdict.Clean)
            {
                await error.WriteLineAsync("Failed: the summary held a personal value, so it was not written.").ConfigureAwait(false);
                return Program.Failed;
            }

            var summaryPath = await FindingsWriter.WriteSummaryAsync(localRoot, summary, time, cancellationToken).ConfigureAwait(false);
            await output.WriteLineAsync($"Summary (counts only): {summaryPath}").ConfigureAwait(false);
            return Program.Succeeded;
        }
        catch (Exception exception)
        {
            await error.WriteLineAsync($"Failed: {exception.GetType().Name}").ConfigureAwait(false);
            return Program.Failed;
        }
    }

    // Drops the trial database with no cancellation, then asks the server again by name. A hard kill is the only way past this, and
    // Remove-StaleTestDatabases.ps1 cleans up after one.
    private static async Task<bool> RemoveTrialAsync(string serverTemplate, string trialName, TextWriter error)
    {
        try
        {
            await TrialDatabase.DropAsync(serverTemplate, trialName).ConfigureAwait(false);
            if (!await TrialDatabase.ExistsAsync(serverTemplate, trialName, CancellationToken.None).ConfigureAwait(false))
            {
                return true;
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Fall through to the failure text: the exception type is not needed beyond the missing confirmation.
        }

        await error.WriteLineAsync("Failed: the trial database could not be removed. Run tools/scripts/Remove-StaleTestDatabases.ps1.").ConfigureAwait(false);
        return false;
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

    private static Finding InventoryFinding(ColumnInventoryResult inventory) =>
        new(
            RecordKind.Run,
            "Run",
            FindingType.Info,
            "column.inventory",
            null,
            string.Create(CultureInfo.InvariantCulture, $"Column inventory: {inventory.ColumnsRead} columns read, {inventory.Unknown} unknown, {inventory.Missing} missing"),
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

        // The column list comes first: a mapped column the restore lacks would make every table query below fail.
        var columns = await source.Columns.Where(static column => column.TableSchema == "dbo").ToListAsync(cancellationToken).ConfigureAwait(false);
        if (ColumnInventory.Check(columns).Missing > 0)
        {
            var unchanged = await WriteEvidence.CaptureAsync(source, cancellationToken).ConfigureAwait(false);
            return new ReadResult([], [], [], [], columns, before, unchanged, [], [], new HashSet<string>(StringComparer.OrdinalIgnoreCase));
        }

        var types = await source.OrderTypes.ToDictionaryAsync(static row => row.OrderTypeId, static row => row.OrderTypeName, cancellationToken).ConfigureAwait(false);
        var statuses = await source.Statuses.ToDictionaryAsync(static row => row.StatusId, static row => row.StatusName, cancellationToken).ConfigureAwait(false);
        var orders = await source.Orders.OrderBy(static row => row.OrderId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var items = (await source.OrderItems.OrderBy(static row => row.OrderItemId).ToListAsync(cancellationToken).ConfigureAwait(false))
            .ToLookup(static row => row.OrderId);

        var discounts = (await source.Discounts.OrderBy(static row => row.OrderDiscountId).ToListAsync(cancellationToken).ConfigureAwait(false)).ToLookup(static row => row.OrderId);
        var payments = (await source.Payments.OrderBy(static row => row.PaymentId).ToListAsync(cancellationToken).ConfigureAwait(false)).ToLookup(static row => row.OrderId);
        var linkedRows = await source.Expenses.Where(static row => !row.IsCompanyExpenses && row.OrderId != null).OrderBy(static row => row.ExpenseId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var expenses = linkedRows.ToLookup(static row => row.OrderId!.Value);

        // A soft-deleted order is still a row here, so its expenses are not "missing"; only an id with no order row at all is.
        var orderIds = orders.Select(static order => order.OrderId).ToHashSet();
        var orderMissingRows = linkedRows.Where(row => !orderIds.Contains(row.OrderId!.Value)).ToList();

        var companyRows = await source.Expenses.Where(static row => row.IsCompanyExpenses).OrderBy(static row => row.ExpenseId).ToListAsync(cancellationToken).ConfigureAwait(false);
        var unplacedRows = await source.Expenses.Where(static row => !row.IsCompanyExpenses && row.OrderId == null).OrderBy(static row => row.ExpenseId).ToListAsync(cancellationToken).ConfigureAwait(false);

        var users = await source.Users.ToListAsync(cancellationToken).ConfigureAwait(false);
        var roles = await source.Roles.ToListAsync(cancellationToken).ConfigureAwait(false);
        var people = PeopleMatching.Build(users, roles, await source.UserRoles.ToListAsync(cancellationToken).ConfigureAwait(false));
        var typeWords = orders.Select(order => order.OrderTypeId is { } id && types.TryGetValue(id, out var word) ? word : null);
        var lists = ListMatching.ForProductTypes(typeWords);
        var mapped = orders
            .Select(order => DraftMapping.MapOrder(order, new LegacyOrderParts([.. items[order.OrderId]], [.. discounts[order.OrderId]], [.. payments[order.OrderId]], [.. expenses[order.OrderId]]), types, statuses, lists, people))
            .ToList();
        var companyExpenses = companyRows.Select(row => DraftMapping.MapCompanyExpense(row, people)).ToList();

        if (hooks?.BetweenEvidence is { } between)
        {
            await between(cancellationToken).ConfigureAwait(false);
        }

        var after = await WriteEvidence.CaptureAsync(source, cancellationToken).ConfigureAwait(false);
        // The personal-ish text this run read, for the privacy self-check of the summary (D-02).
        IEnumerable<string?> readValues =
        [
            .. orders.SelectMany(static order => new[] { order.OrderName, order.Note }),
            .. items.SelectMany(static group => group).Select(static row => row.Description),
            .. discounts.SelectMany(static group => group).SelectMany(static row => new[] { row.Description, row.DiscountedBy }),
            .. payments.SelectMany(static group => group).SelectMany(static row => new[] { row.PaidBy, row.PaidTo }),
            .. expenses.SelectMany(static group => group).SelectMany(static row => new[] { row.Description, row.PaidBy }),
            .. companyRows.SelectMany(static row => new[] { row.Description, row.PaidBy }),
            .. unplacedRows.SelectMany(static row => new[] { row.Description, row.PaidBy }),
            .. users.SelectMany(static user => new[] { user.UserName, user.Email }),
        ];

        // The list words the summary may print: the legacy order type, status and role names read here, and the CSPS list names.
        IEnumerable<string?> allowed =
        [
            .. types.Values,
            .. statuses.Values,
            .. roles.Select(static role => role.Name),
            .. OrderListSeed.ProductTypes.Select(static row => row.Name),
            .. OrderListSeed.PaymentMethods.Select(static row => row.Name),
            .. OrderListSeed.OrderExpenseCategories.Select(static row => row.Name),
            ListMatching.UnknownPaymentMethod.Name,
        ];
        var allowedWords = allowed.Where(static word => !string.IsNullOrWhiteSpace(word)).Select(static word => word!.Trim()).ToHashSet(StringComparer.OrdinalIgnoreCase);

        return new ReadResult(mapped, companyExpenses, lists.TrialEntries, people.TrialStaff, columns, before, after, [.. unplacedRows.Select(static row => DraftMapping.MapUnplacedExpense(row)), .. orderMissingRows.Select(static row => DraftMapping.MapOrderMissingExpense(row))], [.. readValues.Where(static value => !string.IsNullOrWhiteSpace(value)).Select(static value => value!)], allowedWords);
    }

    private sealed record ReadResult(
        IReadOnlyList<MappedOrder> Orders,
        IReadOnlyList<MappedCompanyExpense> CompanyExpenses,
        IReadOnlyList<TrialListEntry> TrialEntries,
        IReadOnlyList<TrialStaff> TrialStaff,
        IReadOnlyList<LegacyColumn> Columns,
        WriteEvidenceSnapshot Before,
        WriteEvidenceSnapshot After,
        IReadOnlyList<Finding> CountedOnlyExpenses,
        IReadOnlyList<string> ReadValues,
        IReadOnlySet<string> AllowedWords);
}
