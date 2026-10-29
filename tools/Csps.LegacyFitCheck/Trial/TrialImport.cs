using System.Globalization;
using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Common;
using Csps.Domain.Orders;
using Csps.Infrastructure;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Orders;
using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>Imports each mapped order into the trial database through the same handler the Phase 16 import will use (D-07).</summary>
internal static class TrialImport
{
    public static async Task<IReadOnlyList<Finding>> RunAsync(
        string trialConnectionString,
        IReadOnlyList<MappedOrder> orders,
        IReadOnlyList<TrialListEntry> trialEntries,
        IReadOnlyList<TrialStaff> trialStaff,
        TimeProvider time,
        CancellationToken cancellationToken,
        Func<string, int, Result<Guid>?>? overrideResult = null)
    {
        ArgumentNullException.ThrowIfNull(orders);
        ArgumentNullException.ThrowIfNull(trialEntries);
        ArgumentNullException.ThrowIfNull(trialStaff);

        var services = new ServiceCollection();
        services.AddSingleton(time);
        services.AddCspsPersistence(trialConnectionString);
        services.AddCspsOrders();
        services.AddCspsExpenses();
        services.AddScoped<IUnitOfWork, CspsUnitOfWork>();
        services.AddScoped<IBusinessCalendar>(_ => new ToolCalendar(time));
        services.AddScoped<ImportOrderHandler>();

        var provider = services.BuildServiceProvider();
        await using (provider.ConfigureAwait(false))
        {
            await SeedAsync(provider, trialEntries, trialStaff, time, cancellationToken).ConfigureAwait(false);

            var findings = new List<Finding>();
            foreach (var order in orders.Where(static order => order.Snapshot is not null))
            {
                findings.AddRange(await ImportOneAsync(provider, order, overrideResult, cancellationToken).ConfigureAwait(false));
            }

            findings.AddRange(await CounterFindingsAsync(provider, cancellationToken).ConfigureAwait(false));
            return findings;
        }
    }

    // One scope per attempt: a fresh context each time, so a failed save cannot touch the next order or the retry. A busy answer is
    // tried once more, like a staff member pressing Save again. An exception is recorded by type name only and the run goes on.
    private static async Task<IReadOnlyList<Finding>> ImportOneAsync(
        ServiceProvider provider,
        MappedOrder order,
        Func<string, int, Result<Guid>?>? overrideResult,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await AttemptAsync(provider, order, 1, overrideResult, cancellationToken).ConfigureAwait(false);
            if (IsBusy(result))
            {
                result = await AttemptAsync(provider, order, 2, overrideResult, cancellationToken).ConfigureAwait(false);
            }

            return result.IsSuccess ? [Imported(order.LegacyKey)] : [.. Failures(order.LegacyKey, result.Error)];
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            return [Failed(order.LegacyKey, "trial.exception", "The trial import threw an exception.", exception.GetType().Name)];
        }
    }

    private static async Task<Result<Guid>> AttemptAsync(
        ServiceProvider provider,
        MappedOrder order,
        int attempt,
        Func<string, int, Result<Guid>?>? overrideResult,
        CancellationToken cancellationToken)
    {
        if (overrideResult?.Invoke(order.LegacyKey, attempt) is { } replaced)
        {
            return replaced;
        }

        var scope = provider.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var handler = scope.ServiceProvider.GetRequiredService<ImportOrderHandler>();
            return await handler.HandleAsync(order.Snapshot!, OrderImportRules.Default, cancellationToken).ConfigureAwait(false);
        }
    }

    private static bool IsBusy(Result<Guid> result) => result.IsFailure && result.Error.Code == OrderErrors.BusyCode;

    // The year counters the import lifted. The values are only in the Detail, which goes to the local file; the message names the year.
    private static async Task<IEnumerable<Finding>> CounterFindingsAsync(ServiceProvider provider, CancellationToken cancellationToken)
    {
        var scope = provider.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            var counters = await context.OrderNumberCounters.AsNoTracking().OrderBy(static counter => counter.Year).ToListAsync(cancellationToken).ConfigureAwait(false);
            return counters
                .Where(static counter => counter.LastValue > 0)
                .Select(static counter => new Finding(
                    RecordKind.Run,
                    "Run",
                    FindingType.Info,
                    "trial.counter-lifted",
                    null,
                    string.Create(CultureInfo.InvariantCulture, $"The order number counter of {counter.Year} was lifted by the import."),
                    null,
                    counter.LastValue.ToString(CultureInfo.InvariantCulture)))
                .ToList();
        }
    }

    private static async Task SeedAsync(ServiceProvider provider, IReadOnlyList<TrialListEntry> trialEntries, IReadOnlyList<TrialStaff> trialStaff, TimeProvider time, CancellationToken cancellationToken)
    {
        var scope = provider.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            await TrialSeeder.SeedListsAsync(context, trialEntries, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
            await TrialSeeder.SeedStaffAsync(context, trialStaff, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        }
    }

    private static Finding Imported(string key) =>
        new(RecordKind.Order, key, FindingType.Info, "trial.imported", null, "Imported into the trial database.", null, null);

    private static Finding Failed(string key, string ruleKey, string message, string? detail, string? path = null) =>
        new(RecordKind.Order, key, FindingType.TrialImport, ruleKey, path, message, null, detail);

    // 422 number taken, 409 busy (after the retry), otherwise 400: one finding per field path and message, or one for the error itself.
    private static IEnumerable<Finding> Failures(string key, Error error)
    {
        if (error.Code == OrderErrors.NumberTakenCode)
        {
            yield return Failed(key, "trial.number-taken", error.Message, null);
            yield break;
        }

        if (error.Code == OrderErrors.BusyCode)
        {
            yield return Failed(key, "trial.busy", error.Message, null);
            yield break;
        }

        if (error.FieldErrors is not { Count: > 0 } fields)
        {
            yield return Failed(key, "trial.invalid", error.Message, error.Code);
            yield break;
        }

        foreach (var (path, messages) in fields)
        {
            foreach (var message in messages)
            {
                yield return Failed(key, "trial.invalid", message, error.Code, path);
            }
        }
    }
}
