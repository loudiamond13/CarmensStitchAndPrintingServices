using Csps.Application.Orders;
using Csps.Application.Ports;
using Csps.Domain.Orders;
using Csps.Infrastructure;
using Csps.Infrastructure.Expenses;
using Csps.Infrastructure.Orders;
using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Findings;
using Csps.LegacyFitCheck.Mapping;
using Microsoft.Extensions.DependencyInjection;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>Imports each mapped order into the trial database through the same handler the Phase 16 import will use (D-07).</summary>
internal static class TrialImport
{
    public static async Task<IReadOnlyList<Finding>> RunAsync(
        string trialConnectionString,
        IReadOnlyList<MappedOrder> orders,
        IReadOnlyList<TrialListEntry> trialEntries,
        TimeProvider time,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(orders);
        ArgumentNullException.ThrowIfNull(trialEntries);

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
            await SeedAsync(provider, trialEntries, time, cancellationToken).ConfigureAwait(false);

            var findings = new List<Finding>();
            foreach (var order in orders.Where(static order => order.Snapshot is not null))
            {
                // One scope per order: a fresh context each time, so a failed save cannot touch the next order.
                var scope = provider.CreateAsyncScope();
                await using (scope.ConfigureAwait(false))
                {
                    var handler = scope.ServiceProvider.GetRequiredService<ImportOrderHandler>();
                    var result = await handler.HandleAsync(order.Snapshot!, OrderImportRules.Default, cancellationToken).ConfigureAwait(false);
                    findings.AddRange(result.IsSuccess ? [Imported(order.LegacyKey)] : Failures(order.LegacyKey, result.Error));
                }
            }

            return findings;
        }
    }

    private static async Task SeedAsync(ServiceProvider provider, IReadOnlyList<TrialListEntry> trialEntries, TimeProvider time, CancellationToken cancellationToken)
    {
        var scope = provider.CreateAsyncScope();
        await using (scope.ConfigureAwait(false))
        {
            var context = scope.ServiceProvider.GetRequiredService<CspsDbContext>();
            await TrialSeeder.SeedListsAsync(context, trialEntries, time.GetUtcNow(), cancellationToken).ConfigureAwait(false);
        }
    }

    private static Finding Imported(string key) =>
        new(RecordKind.Order, key, FindingType.Info, "import.imported", null, "Imported into the trial database.", null, null);

    private static IEnumerable<Finding> Failures(string key, Csps.Domain.Common.Error error)
    {
        if (error.FieldErrors is not { Count: > 0 } fields)
        {
            yield return new Finding(RecordKind.Order, key, FindingType.TrialImport, error.Code, null, error.Message, null, null);
            yield break;
        }

        foreach (var (path, messages) in fields)
        {
            foreach (var message in messages)
            {
                yield return new Finding(RecordKind.Order, key, FindingType.TrialImport, error.Code, path, message, null, null);
            }
        }
    }
}
