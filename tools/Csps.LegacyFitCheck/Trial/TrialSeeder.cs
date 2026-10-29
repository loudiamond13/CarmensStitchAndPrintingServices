using Csps.Domain.OrderLists;
using Csps.Infrastructure.Persistence;
using Csps.LegacyFitCheck.Mapping;

namespace Csps.LegacyFitCheck.Trial;

/// <summary>Writes the trial-only list entries into the trial database (D-06). It only ever gets the trial context.</summary>
internal static class TrialSeeder
{
    public static async Task SeedListsAsync(
        CspsDbContext trialContext,
        IReadOnlyList<TrialListEntry> entries,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(trialContext);
        ArgumentNullException.ThrowIfNull(entries);

        foreach (var entry in entries)
        {
            switch (entry.Kind)
            {
                case OrderListKind.ProductType:
                    Add(trialContext, ProductType.Create(entry.Name, Tone, now), entry.Id, static (context, row) => context.ProductTypes.Add(row));
                    break;
                case OrderListKind.PaymentMethod:
                    Add(trialContext, PaymentMethod.Create(entry.Name, Tone, now), entry.Id, static (context, row) => context.PaymentMethods.Add(row));
                    break;
                default:
                    throw new ArgumentOutOfRangeException(nameof(entries), entry.Kind, "Only product types and payment methods get trial-only entries.");
            }
        }

        await trialContext.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
    }

    private static string Tone => Csps.Domain.Expenses.CategoryTones.Neutral;

    // The domain factory makes the entry and its own id; the snapshots already point at the given id, so it is set before the add.
    private static void Add<TEntry>(CspsDbContext context, Csps.Domain.Common.Result<TEntry> created, Guid id, Action<CspsDbContext, TEntry> add)
        where TEntry : OrderListEntry
    {
        if (created.IsFailure)
        {
            throw new InvalidOperationException("A trial-only list entry was refused by the domain.");
        }

        var row = created.Value;
        context.Entry(row).Property(static entry => entry.Id).CurrentValue = id;
        add(context, row);
    }
}
