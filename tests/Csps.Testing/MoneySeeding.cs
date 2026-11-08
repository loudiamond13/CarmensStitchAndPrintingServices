using Csps.Domain.Money;

namespace Csps.Testing;

/// <summary>A transfer row to write straight to a test database.</summary>
/// <param name="FromUserId">The sender; for a hand-over, the former staff member.</param>
/// <param name="ToUserId">The recipient.</param>
/// <param name="Amount">The amount in pesos.</param>
/// <param name="Date">The transfer date.</param>
public sealed record SeedTransfer(Guid FromUserId, Guid ToUserId, decimal Amount, DateOnly Date)
{
    /// <summary>Gets who recorded it; the sender when null.</summary>
    public Guid? CreatedById { get; init; }

    /// <summary>Gets the note of the transfer; none when null.</summary>
    public string? Note { get; init; }

    /// <summary>Gets a value indicating whether the row is a hand-over by a Manager for a former staff member.</summary>
    public bool IsHandover { get; init; }

    /// <summary>Gets a value indicating whether the row is soft-deleted after it is written.</summary>
    public bool Deleted { get; init; }
}

/// <summary>Writes money transfers straight to a test database for reader and endpoint tests, until the transfer endpoints exist.</summary>
public static class MoneySeeding
{
    /// <summary>Writes one transfer through the domain factories, then applies the recorder, the recorded time and the delete mark.</summary>
    /// <param name="database">The test database.</param>
    /// <param name="spec">The transfer to write.</param>
    /// <param name="now">The instant it is recorded at.</param>
    /// <returns>The new transfer id.</returns>
    public static async Task<Guid> AddTransferAsync(CspsDatabase database, SeedTransfer spec, DateTimeOffset now)
    {
        ArgumentNullException.ThrowIfNull(database);
        ArgumentNullException.ThrowIfNull(spec);

        // The factories check balances; the seeded parties hold exactly the amount so the rules pass.
        var recipient = new MoneyParty(spec.ToUserId, "Recipient", MoneyPartyStatus.Active, 0m);
        var created = spec.IsHandover
            ? MoneyTransfer.RecordHandover(
                new MoneyParty(spec.FromUserId, "Leaver", MoneyPartyStatus.Deactivated, spec.Amount),
                recipient,
                spec.Amount,
                spec.Date,
                spec.Note,
                spec.Date,
                now)
            : MoneyTransfer.Record(
                new MoneyParty(spec.FromUserId, "Sender", MoneyPartyStatus.Active, spec.Amount),
                recipient,
                spec.Amount,
                spec.Date,
                spec.Note,
                callerIsManager: true,
                spec.Date,
                now);
        var transfer = created.Value;
        var recorder = spec.CreatedById ?? spec.FromUserId;
        if (spec.Deleted && !transfer.SoftDelete(recorder, now.AddMinutes(1)))
        {
            throw new InvalidOperationException("The new transfer was already deleted.");
        }

        var context = database.CreateContext();
        await using (context.ConfigureAwait(false))
        {
            context.Set<MoneyTransfer>().Add(transfer);
            var entry = context.Entry(transfer);
            entry.Property(row => row.CreatedById).CurrentValue = recorder;
            entry.Property(row => row.CreatedAtUtc).CurrentValue = now;
            await context.SaveChangesAsync().ConfigureAwait(false);
        }

        return transfer.Id;
    }
}
